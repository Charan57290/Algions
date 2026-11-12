import { Types, ClientSession } from 'mongoose';
import { Return, IReturn, IReturnItem } from '../models/Return.js';
import { Sale, SaleStatus } from '../models/Sale.js';
import { Batch } from '../models/Batch.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';
import { IUser } from '../models/User.js';

export interface ReturnItemRequest {
  medicineId: string;
  batchId: string;
  quantityReturned: number;
  reason: string;
  restockable?: boolean;
}

export interface ProcessReturnInput {
  saleId: string;
  items: ReturnItemRequest[];
  overallReason: string;
  notes?: string;
}

export const processCustomerReturnTransaction = async (
  input: ProcessReturnInput,
  processedBy: IUser,
  session?: ClientSession
): Promise<IReturn> => {
  const { saleId, items, overallReason, notes } = input;

  const sale = await Sale.findById(saleId).session(session || null);
  if (!sale) {
    throw new Error(`Original sale transaction with ID '${saleId}' not found.`);
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new Error('Cannot process return on a cancelled sale transaction.');
  }

  if (sale.status === SaleStatus.REFUNDED) {
    throw new Error('All items from this sale invoice have already been fully returned and refunded.');
  }

  // Fetch all prior returns for this sale to compute remaining returnable quantities per batch
  const priorReturns = await Return.find({ sale: sale._id }).session(session || null);
  const previouslyReturnedMap = new Map<string, number>();

  for (const prevRet of priorReturns) {
    for (const prevItem of prevRet.items) {
      const key = `${prevItem.medicine.toString()}_${prevItem.batch.toString()}`;
      const existingQty = previouslyReturnedMap.get(key) || 0;
      previouslyReturnedMap.set(key, existingQty + prevItem.quantityReturned);
    }
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const returnCount = await Return.countDocuments();
  const returnNumber = `RET-${yearMonth}-${String(returnCount + 1).padStart(4, '0')}`;

  const processedReturnItems: IReturnItem[] = [];
  let totalRefundAmount = 0;

  for (const itemInput of items) {
    // Locate the matching line item in original sale
    const saleItem = sale.items.find(
      (si) =>
        si.medicine.toString() === itemInput.medicineId &&
        si.batch.toString() === itemInput.batchId
    );

    if (!saleItem) {
      throw new Error(
        `Medicine '${itemInput.medicineId}' with batch '${itemInput.batchId}' was not purchased under invoice '${sale.invoiceNumber}'.`
      );
    }

    const key = `${itemInput.medicineId}_${itemInput.batchId}`;
    const alreadyReturned = previouslyReturnedMap.get(key) || 0;
    const returnableLimit = saleItem.quantity - alreadyReturned;

    if (itemInput.quantityReturned > returnableLimit) {
      throw new Error(
        `Cannot return ${itemInput.quantityReturned} units of '${saleItem.medicineName}' (Batch: ${saleItem.batchNumber}). Originally purchased: ${saleItem.quantity}, previously returned: ${alreadyReturned}, maximum returnable: ${returnableLimit}.`
      );
    }

    // Calculate proportional refund: unit price * quantity, adjusting for line discount and tax
    const unitRefundPrice = Math.round((saleItem.total / saleItem.quantity) * 100) / 100;
    const itemRefundTotal = Math.round(unitRefundPrice * itemInput.quantityReturned * 100) / 100;
    totalRefundAmount += itemRefundTotal;

    const batch = await Batch.findById(itemInput.batchId).session(session || null);
    if (!batch) {
      throw new Error(`Batch record '${itemInput.batchId}' not found.`);
    }

    const isExpired = new Date(batch.expiryDate) <= now;
    // Strict Safety Rule: Expired items can NEVER be restocked regardless of request!
    const canRestock = Boolean(itemInput.restockable) && !isExpired;

    if (canRestock) {
      const prevBal = batch.availableQuantity;
      const newBal = prevBal + itemInput.quantityReturned;
      batch.availableQuantity = newBal;
      await batch.save({ session });

      // Record stock ledger addition
      const movement = new StockMovement({
        medicine: batch.medicine,
        batch: batch._id,
        movementType: MovementType.CUSTOMER_RETURN,
        quantityAdded: itemInput.quantityReturned,
        quantityRemoved: 0,
        previousBalance: prevBal,
        newBalance: newBal,
        reason: `Customer return restocked (Invoice: ${sale.invoiceNumber}, Reason: ${itemInput.reason})`,
        relatedTransactionId: returnNumber,
        relatedTransactionType: 'RETURN',
        user: processedBy._id,
      });
      await movement.save({ session });
    } else {
      // Non-restockable or expired: do NOT increment batch sellable balance
      const movement = new StockMovement({
        medicine: batch.medicine,
        batch: batch._id,
        movementType: isExpired ? MovementType.EXPIRED_STOCK : MovementType.DAMAGED_STOCK,
        quantityAdded: 0,
        quantityRemoved: 0,
        previousBalance: batch.availableQuantity,
        newBalance: batch.availableQuantity,
        reason: `Customer return quarantined (Non-restockable / ${isExpired ? 'Expired' : 'Damaged'}, Reason: ${itemInput.reason})`,
        relatedTransactionId: returnNumber,
        relatedTransactionType: 'RETURN_QUARANTINE',
        user: processedBy._id,
      });
      await movement.save({ session });
    }

    processedReturnItems.push({
      medicine: batch.medicine as Types.ObjectId,
      batch: batch._id as Types.ObjectId,
      medicineName: saleItem.medicineName,
      batchNumber: batch.batchNumber,
      quantityReturned: itemInput.quantityReturned,
      unitRefundPrice,
      refundAmount: itemRefundTotal,
      reason: itemInput.reason,
      restockable: canRestock,
    });

    // Update map for subsequent iterations
    previouslyReturnedMap.set(key, alreadyReturned + itemInput.quantityReturned);
  }

  const returnDoc = new Return({
    returnNumber,
    sale: sale._id,
    invoiceNumber: sale.invoiceNumber,
    customer: sale.customer,
    items: processedReturnItems,
    totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
    overallReason,
    processedBy: processedBy._id,
    notes,
  });

  await returnDoc.save({ session });

  // Evaluate if sale is now fully returned or partially refunded
  let allFullyReturned = true;
  for (const si of sale.items) {
    const key = `${si.medicine.toString()}_${si.batch.toString()}`;
    const totalReturned = previouslyReturnedMap.get(key) || 0;
    if (totalReturned < si.quantity) {
      allFullyReturned = false;
      break;
    }
  }

  sale.status = allFullyReturned ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED;
  await sale.save({ session });

  // Record audit log
  await AuditLog.create({
    action: AuditAction.CREATE,
    entity: AuditEntity.RETURN,
    entityId: returnDoc._id.toString(),
    performedBy: processedBy._id,
    details: {
      returnNumber: returnDoc.returnNumber,
      originalInvoiceNumber: sale.invoiceNumber,
      totalRefundAmount: returnDoc.totalRefundAmount,
      saleNewStatus: sale.status,
    },
    ipAddress: undefined,
  });

  return returnDoc;
};
