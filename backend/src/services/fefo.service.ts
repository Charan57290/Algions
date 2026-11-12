import mongoose, { Types, ClientSession } from 'mongoose';
import { Batch, IBatch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { IUser } from '../models/User.js';

export interface FefoAllocationItem {
  batchId: Types.ObjectId;
  batchNumber: string;
  expiryDate: Date;
  unitSellingPrice: number;
  unitPurchasePrice: number;
  allocatedQuantity: number;
  batchRemainingStock: number;
}

export interface FefoPreviewResult {
  medicineId: string;
  medicineName: string;
  requestedQuantity: number;
  totalAllocated: number;
  remainingDeficit: number;
  isSufficient: boolean;
  allocations: FefoAllocationItem[];
}

export class InsufficientStockError extends Error {
  public requested: number;
  public available: number;
  public deficit: number;

  constructor(requested: number, available: number, message?: string) {
    super(
      message ||
        `Insufficient sellable inventory. Requested ${requested} units, but only ${available} eligible units are available in active non-expired batches.`
    );
    this.name = 'InsufficientStockError';
    this.requested = requested;
    this.available = available;
    this.deficit = requested - available;
  }
}

/**
 * Previews FEFO batch allocation without mutating the database
 */
export const previewFefoAllocation = async (
  medicineId: string,
  requestedQuantity: number
): Promise<FefoPreviewResult> => {
  if (requestedQuantity <= 0) {
    throw new Error('Requested quantity must be greater than zero.');
  }

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw new Error(`Medicine with ID '${medicineId}' not found.`);
  }

  const now = new Date();

  // Find all active, non-expired batches with availableQuantity > 0, sorted by earliest expiry date first (FEFO)
  const eligibleBatches: IBatch[] = await Batch.find({
    medicine: medicine._id,
    expiryDate: { $gt: now }, // Strictly EXCLUDE expired batches
    availableQuantity: { $gt: 0 }, // Strictly EXCLUDE empty batches
  }).sort({ expiryDate: 1, createdAt: 1 });

  let needed = requestedQuantity;
  const allocations: FefoAllocationItem[] = [];

  for (const batch of eligibleBatches) {
    if (needed <= 0) break;

    const allocQty = Math.min(batch.availableQuantity, needed);
    allocations.push({
      batchId: batch._id as Types.ObjectId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      unitSellingPrice: batch.sellingPrice,
      unitPurchasePrice: batch.purchasePrice,
      allocatedQuantity: allocQty,
      batchRemainingStock: batch.availableQuantity - allocQty,
    });

    needed -= allocQty;
  }

  const totalAllocated = requestedQuantity - needed;

  return {
    medicineId: medicine._id.toString(),
    medicineName: medicine.name,
    requestedQuantity,
    totalAllocated,
    remainingDeficit: needed,
    isSufficient: needed === 0,
    allocations,
  };
};

/**
 * Executes atomic FEFO batch deduction, updates batch quantities, and writes immutable StockMovement records
 */
export const executeFefoDeduction = async (
  medicineId: string,
  requestedQuantity: number,
  relatedTransactionId: string,
  transactionType: string,
  user: IUser,
  session?: ClientSession
): Promise<FefoAllocationItem[]> => {
  if (requestedQuantity <= 0) {
    throw new Error('Requested deduction quantity must be greater than zero.');
  }

  const now = new Date();

  // Query eligible batches
  const batchQuery = Batch.find({
    medicine: medicineId,
    expiryDate: { $gt: now },
    availableQuantity: { $gt: 0 },
  }).sort({ expiryDate: 1, createdAt: 1 });

  if (session) {
    batchQuery.session(session);
  }

  const eligibleBatches = await batchQuery.exec();

  const totalAvailable = eligibleBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  if (totalAvailable < requestedQuantity) {
    throw new InsufficientStockError(requestedQuantity, totalAvailable);
  }

  let remainingToDeduct = requestedQuantity;
  const allocatedItems: FefoAllocationItem[] = [];

  for (const batch of eligibleBatches) {
    if (remainingToDeduct <= 0) break;

    const deductQty = Math.min(batch.availableQuantity, remainingToDeduct);
    const previousBalance = batch.availableQuantity;
    const newBalance = previousBalance - deductQty;

    // Enforce non-negative stock invariant
    if (newBalance < 0) {
      throw new Error(`Critical integrity error: negative stock detected on batch ${batch.batchNumber}`);
    }

    // Atomic update of batch stock
    batch.availableQuantity = newBalance;
    await batch.save({ session });

    // Record immutable stock movement ledger entry
    const movement = new StockMovement({
      medicine: batch.medicine,
      batch: batch._id,
      movementType: MovementType.SALE,
      quantityAdded: 0,
      quantityRemoved: deductQty,
      previousBalance,
      newBalance,
      reason: `FEFO outbound sale allocation (${transactionType})`,
      relatedTransactionId,
      relatedTransactionType: transactionType,
      user: user._id,
    });
    await movement.save({ session });

    allocatedItems.push({
      batchId: batch._id as Types.ObjectId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      unitSellingPrice: batch.sellingPrice,
      unitPurchasePrice: batch.purchasePrice,
      allocatedQuantity: deductQty,
      batchRemainingStock: newBalance,
    });

    remainingToDeduct -= deductQty;
  }

  return allocatedItems;
};
