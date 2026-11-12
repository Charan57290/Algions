import { Types, ClientSession } from 'mongoose';
import { Sale, ISale, ISaleItem, PaymentMethod, SaleStatus } from '../models/Sale.js';
import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';
import { IUser } from '../models/User.js';
import { executeFefoDeduction, InsufficientStockError } from './fefo.service.js';

export interface ProcessSaleItemInput {
  medicineId: string;
  quantity: number;
  batchId?: string;
  discountPercent?: number;
}

export interface ProcessSaleInput {
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: ProcessSaleItemInput[];
  totalDiscount?: number;
  taxRate?: number;
  paymentMethod?: PaymentMethod;
  idempotencyKey?: string;
  notes?: string;
}

// In-memory idempotency cache for duplicate sale prevention (5 minute window)
const processedIdempotencyKeys = new Map<string, { saleId: string; timestamp: number }>();

export const processSaleTransaction = async (
  input: ProcessSaleInput,
  cashier: IUser,
  session?: ClientSession
): Promise<ISale> => {
  const {
    customer = { name: 'Walk-in Customer' },
    items,
    totalDiscount = 0,
    taxRate = 5,
    paymentMethod = PaymentMethod.CASH,
    idempotencyKey,
    notes,
  } = input;

  // Prevent duplicate submissions via idempotency key
  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing && Date.now() - existing.timestamp < 300000) {
      const cachedSale = await Sale.findById(existing.saleId);
      if (cachedSale) {
        return cachedSale;
      }
    }
  }

  // Generate sequential invoice number: INV-YYYYMM-XXXX
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await Sale.countDocuments();
  const invoiceNumber = `INV-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

  const processedSaleItems: ISaleItem[] = [];
  let calculatedSubtotal = 0;

  for (const itemInput of items) {
    const medicine = await Medicine.findById(itemInput.medicineId).session(session || null);
    if (!medicine) {
      throw new Error(`Medicine with ID '${itemInput.medicineId}' not found.`);
    }

    if (!medicine.isActive) {
      throw new Error(`Medicine '${medicine.name}' is deactivated and cannot be sold.`);
    }

    // Determine allocations
    if (itemInput.batchId) {
      // Manual specific batch allocation requested by pharmacist
      const batch = await Batch.findById(itemInput.batchId).session(session || null);
      if (!batch) {
        throw new Error(`Specified batch '${itemInput.batchId}' not found.`);
      }

      if (batch.medicine.toString() !== medicine._id.toString()) {
        throw new Error(`Batch '${batch.batchNumber}' does not belong to medicine '${medicine.name}'.`);
      }

      if (new Date(batch.expiryDate) <= now) {
        throw new Error(`Batch '${batch.batchNumber}' is expired and cannot be sold.`);
      }

      if (batch.availableQuantity < itemInput.quantity) {
        throw new InsufficientStockError(itemInput.quantity, batch.availableQuantity, `Batch '${batch.batchNumber}' only has ${batch.availableQuantity} units available.`);
      }

      const prevBal = batch.availableQuantity;
      const newBal = prevBal - itemInput.quantity;
      batch.availableQuantity = newBal;
      await batch.save({ session });

      // Record stock movement
      const movement = new StockMovement({
        medicine: medicine._id,
        batch: batch._id,
        movementType: MovementType.SALE,
        quantityAdded: 0,
        quantityRemoved: itemInput.quantity,
        previousBalance: prevBal,
        newBalance: newBal,
        reason: `POS sale allocation (${invoiceNumber})`,
        relatedTransactionId: invoiceNumber,
        relatedTransactionType: 'SALE',
        user: cashier._id,
      });
      await movement.save({ session });

      const itemDiscount = itemInput.discountPercent ? (batch.sellingPrice * itemInput.quantity * itemInput.discountPercent) / 100 : 0;
      const itemTaxAmt = ((batch.sellingPrice * itemInput.quantity - itemDiscount) * taxRate) / 100;
      const itemTotal = batch.sellingPrice * itemInput.quantity - itemDiscount + itemTaxAmt;

      calculatedSubtotal += batch.sellingPrice * itemInput.quantity;

      processedSaleItems.push({
        medicine: medicine._id as Types.ObjectId,
        batch: batch._id as Types.ObjectId,
        medicineName: medicine.name,
        batchNumber: batch.batchNumber,
        quantity: itemInput.quantity,
        unitPrice: batch.sellingPrice,
        purchasePriceSnapshot: batch.purchasePrice,
        discount: itemDiscount,
        taxRate,
        taxAmount: itemTaxAmt,
        total: itemTotal,
      });
    } else {
      // Automated FEFO allocation across earliest-expiring active batches
      const allocations = await executeFefoDeduction(
        medicine._id.toString(),
        itemInput.quantity,
        invoiceNumber,
        'POS_SALE',
        cashier,
        session
      );

      for (const alloc of allocations) {
        const itemDiscount = itemInput.discountPercent ? (alloc.unitSellingPrice * alloc.allocatedQuantity * itemInput.discountPercent) / 100 : 0;
        const itemTaxAmt = ((alloc.unitSellingPrice * alloc.allocatedQuantity - itemDiscount) * taxRate) / 100;
        const itemTotal = alloc.unitSellingPrice * alloc.allocatedQuantity - itemDiscount + itemTaxAmt;

        calculatedSubtotal += alloc.unitSellingPrice * alloc.allocatedQuantity;

        processedSaleItems.push({
          medicine: medicine._id as Types.ObjectId,
          batch: alloc.batchId,
          medicineName: medicine.name,
          batchNumber: alloc.batchNumber,
          quantity: alloc.allocatedQuantity,
          unitPrice: alloc.unitSellingPrice,
          purchasePriceSnapshot: alloc.unitPurchasePrice,
          discount: itemDiscount,
          taxRate,
          taxAmount: itemTaxAmt,
          total: itemTotal,
        });
      }
    }
  }

  // Calculate overall financial totals
  const subtotalAfterDiscounts = Math.max(0, calculatedSubtotal - totalDiscount);
  const totalTaxAmount = (subtotalAfterDiscounts * taxRate) / 100;
  const grandTotal = Math.round((subtotalAfterDiscounts + totalTaxAmount) * 100) / 100;

  const sale = new Sale({
    invoiceNumber,
    customer,
    items: processedSaleItems,
    subtotal: Math.round(calculatedSubtotal * 100) / 100,
    totalDiscount,
    taxRate,
    taxAmount: Math.round(totalTaxAmount * 100) / 100,
    grandTotal,
    paymentMethod,
    status: SaleStatus.COMPLETED,
    cashier: cashier._id,
    notes,
  });

  await sale.save({ session });

  // Record audit log
  await AuditLog.create({
    action: AuditAction.CREATE,
    entity: AuditEntity.SALE,
    entityId: sale._id.toString(),
    performedBy: cashier._id,
    details: {
      invoiceNumber: sale.invoiceNumber,
      itemCount: sale.items.length,
      grandTotal: sale.grandTotal,
      paymentMethod: sale.paymentMethod,
    },
  });

  // Cache idempotency key
  if (idempotencyKey) {
    processedIdempotencyKeys.set(idempotencyKey, {
      saleId: sale._id.toString(),
      timestamp: Date.now(),
    });
  }

  return sale;
};

export const generatePrintableInvoice = async (saleId: string) => {
  const sale = await Sale.findById(saleId)
    .populate('cashier', 'name email')
    .populate('items.medicine', 'name genericName medicineCode strength unitOfMeasurement');

  if (!sale) {
    throw new Error('Sale not found');
  }

  return {
    pharmacyHeader: {
      storeName: 'PharmaCare Pharmacy & Medical Store',
      tagline: 'Algions AI Labs Assessment Healthcare Solutions',
      address: 'Plot 42, Health City Avenue, Bengaluru, Karnataka 560001',
      phone: '+91 (080) 2345-6789',
      gstin: '29ABCDE1234F1Z5',
      drugLicenseNo: 'KA-BNG-2026-DL-00452',
    },
    invoiceMeta: {
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      cashierName: (sale.cashier as any)?.name || 'Staff Cashier',
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.status,
    },
    customer: sale.customer || { name: 'Walk-in Customer' },
    items: sale.items.map((item) => ({
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxAmount: item.taxAmount,
      total: item.total,
    })),
    summary: {
      subtotal: sale.subtotal,
      totalDiscount: sale.totalDiscount,
      taxRate: `${sale.taxRate}%`,
      taxAmount: sale.taxAmount,
      grandTotal: sale.grandTotal,
      currency: 'INR',
    },
    legalFooter: {
      disclaimer: 'Medicines sold are strictly fictional for software demonstration purposes only. Consult a licensed physician for real healthcare needs.',
      returnPolicy: 'Goods once sold can only be returned within 7 days with valid original invoice and batch packaging intact.',
    },
  };
};
