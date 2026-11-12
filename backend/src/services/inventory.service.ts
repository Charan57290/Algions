import { Types, ClientSession } from 'mongoose';
import { Batch, IBatch } from '../models/Batch.js';
import { Purchase, IPurchase, PurchasePaymentStatus } from '../models/Purchase.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { Medicine } from '../models/Medicine.js';
import { Supplier } from '../models/Supplier.js';
import { IUser } from '../models/User.js';

export interface PurchaseItemInput {
  medicineId: string;
  batchNumber: string;
  manufacturingDate: Date | string;
  expiryDate: Date | string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
}

export interface ReceiveStockInput {
  supplierId: string;
  supplierInvoiceNumber: string;
  purchaseDate?: Date | string;
  items: PurchaseItemInput[];
  taxAmount?: number;
  paymentStatus?: PurchasePaymentStatus;
  notes?: string;
}

export const receivePurchaseConsignment = async (
  input: ReceiveStockInput,
  user: IUser,
  session?: ClientSession
): Promise<IPurchase> => {
  const { supplierId, supplierInvoiceNumber, items, taxAmount = 0, paymentStatus, notes } = input;

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw new Error(`Supplier with ID '${supplierId}' not found.`);
  }

  // Generate unique purchase sequence
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await Purchase.countDocuments();
  const purchaseNumber = `PO-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const medicine = await Medicine.findById(item.medicineId);
    if (!medicine) {
      throw new Error(`Medicine with ID '${item.medicineId}' not found.`);
    }

    const itemTotal = item.quantity * item.purchasePrice;
    subtotal += itemTotal;

    const mfgDate = new Date(item.manufacturingDate);
    const expDate = new Date(item.expiryDate);

    if (expDate <= mfgDate) {
      throw new Error(`Expiry date must be after manufacturing date for batch '${item.batchNumber}'.`);
    }

    // Check if batch already exists for this medicine
    let batch: IBatch | null = await Batch.findOne({
      medicine: medicine._id,
      batchNumber: item.batchNumber.toUpperCase().trim(),
    }).session(session || null);

    let previousBalance = 0;
    let newBalance = item.quantity;

    if (batch) {
      previousBalance = batch.availableQuantity;
      newBalance = previousBalance + item.quantity;
      batch.availableQuantity = newBalance;
      batch.purchasePrice = item.purchasePrice;
      batch.sellingPrice = item.sellingPrice;
      await batch.save({ session });
    } else {
      batch = new Batch({
        medicine: medicine._id,
        batchNumber: item.batchNumber.toUpperCase().trim(),
        supplier: supplier._id,
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        initialQuantity: item.quantity,
        availableQuantity: item.quantity,
      });
      await batch.save({ session });
    }

    // Record immutable stock movement ledger entry
    const movement = new StockMovement({
      medicine: medicine._id,
      batch: batch._id,
      movementType: MovementType.PURCHASE_RECEIVED,
      quantityAdded: item.quantity,
      quantityRemoved: 0,
      previousBalance,
      newBalance,
      reason: `Stock receipt from supplier '${supplier.name}' (PO: ${purchaseNumber})`,
      relatedTransactionId: purchaseNumber,
      relatedTransactionType: 'PURCHASE',
      user: user._id,
    });
    await movement.save({ session });

    processedItems.push({
      medicine: medicine._id as Types.ObjectId,
      batchNumber: item.batchNumber.toUpperCase().trim(),
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      totalAmount: itemTotal,
      batch: batch._id as Types.ObjectId,
    });
  }

  const totalAmount = subtotal + taxAmount;

  const purchase = new Purchase({
    purchaseNumber,
    supplier: supplier._id,
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
    supplierInvoiceNumber,
    items: processedItems,
    subtotal,
    taxAmount,
    totalAmount,
    paymentStatus: paymentStatus || PurchasePaymentStatus.PAID,
    receivedBy: user._id,
    notes,
  });

  await purchase.save({ session });

  return purchase;
};

export const calculateInventoryValuation = async () => {
  const now = new Date();

  const [activeValuation] = await Batch.aggregate([
    {
      $match: {
        expiryDate: { $gt: now },
        availableQuantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalCostValue: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
        totalRetailValue: { $sum: { $multiply: ['$availableQuantity', '$sellingPrice'] } },
        totalUnits: { $sum: '$availableQuantity' },
        batchCount: { $sum: 1 },
      },
    },
  ]);

  const [expiredValuation] = await Batch.aggregate([
    {
      $match: {
        expiryDate: { $lte: now },
        availableQuantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalCostValue: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
        totalUnits: { $sum: '$availableQuantity' },
        batchCount: { $sum: 1 },
      },
    },
  ]);

  const activeCost = activeValuation?.totalCostValue || 0;
  const activeRetail = activeValuation?.totalRetailValue || 0;
  const expectedGrossProfit = activeRetail - activeCost;
  const grossMarginPercent = activeRetail > 0 ? (expectedGrossProfit / activeRetail) * 100 : 0;

  return {
    activeInventory: {
      totalCostValue: Math.round(activeCost * 100) / 100,
      totalRetailValue: Math.round(activeRetail * 100) / 100,
      expectedGrossProfit: Math.round(expectedGrossProfit * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      totalUnits: activeValuation?.totalUnits || 0,
      batchCount: activeValuation?.batchCount || 0,
    },
    expiredInventory: {
      totalLossCost: Math.round((expiredValuation?.totalCostValue || 0) * 100) / 100,
      totalUnits: expiredValuation?.totalUnits || 0,
      batchCount: expiredValuation?.batchCount || 0,
    },
    reconciliationTimestamp: new Date().toISOString(),
  };
};

export const getNearExpiryBatches = async (daysThreshold = 30) => {
  const now = new Date();
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + daysThreshold);

  const batches = await Batch.find({
    expiryDate: { $gt: now, $lte: alertDate },
    availableQuantity: { $gt: 0 },
  })
    .populate('medicine', 'name genericName medicineCode sku')
    .populate('supplier', 'name supplierCode phone')
    .sort({ expiryDate: 1 });

  return batches.map((batch) => {
    const diffTime = new Date(batch.expiryDate).getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      ...batch.toObject(),
      daysUntilExpiry,
      urgencyLevel: daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 15 ? 'HIGH' : 'MODERATE',
    };
  });
};
