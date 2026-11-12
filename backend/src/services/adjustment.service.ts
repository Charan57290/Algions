import { Types, ClientSession } from 'mongoose';
import {
  StockAdjustment,
  IStockAdjustment,
  AdjustmentType,
  AdjustmentReason,
} from '../models/StockAdjustment.js';
import { Batch } from '../models/Batch.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';
import { IUser } from '../models/User.js';

export interface ProcessAdjustmentInput {
  batchId: string;
  adjustmentType: AdjustmentType;
  adjustedQuantity: number;
  reason: AdjustmentReason;
  remarks: string;
}

export const processStockAdjustmentTransaction = async (
  input: ProcessAdjustmentInput,
  adjustedBy: IUser,
  session?: ClientSession
): Promise<IStockAdjustment> => {
  const { batchId, adjustmentType, adjustedQuantity, reason, remarks } = input;

  if (adjustedQuantity <= 0) {
    throw new Error('Adjusted quantity delta must be greater than zero.');
  }

  const batch = await Batch.findById(batchId)
    .populate('medicine', 'name genericName medicineCode')
    .session(session || null);

  if (!batch) {
    throw new Error(`Batch record with ID '${batchId}' not found.`);
  }

  const previousQuantity = batch.availableQuantity;
  let newQuantity: number;

  if (adjustmentType === AdjustmentType.INCREASE) {
    newQuantity = previousQuantity + adjustedQuantity;
  } else {
    // DECREASE
    if (adjustedQuantity > previousQuantity) {
      throw new Error(
        `Cannot decrease stock by ${adjustedQuantity} units. Batch '${batch.batchNumber}' only has ${previousQuantity} units available. Negative stock is strictly prohibited.`
      );
    }
    newQuantity = previousQuantity - adjustedQuantity;
  }

  // Generate sequential adjustment number: ADJ-YYYYMM-XXXX
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await StockAdjustment.countDocuments();
  const adjustmentNumber = `ADJ-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

  // Update batch available quantity
  batch.availableQuantity = newQuantity;
  await batch.save({ session });

  // Create StockAdjustment audit record
  const adjustment = new StockAdjustment({
    adjustmentNumber,
    medicine: batch.medicine._id,
    batch: batch._id,
    adjustmentType,
    previousQuantity,
    adjustedQuantity,
    newQuantity,
    reason,
    remarks,
    adjustedBy: adjustedBy._id,
  });

  await adjustment.save({ session });

  // Record StockMovement ledger entry
  const movement = new StockMovement({
    medicine: batch.medicine._id,
    batch: batch._id,
    movementType: MovementType.STOCK_ADJUSTMENT,
    quantityAdded: adjustmentType === AdjustmentType.INCREASE ? adjustedQuantity : 0,
    quantityRemoved: adjustmentType === AdjustmentType.DECREASE ? adjustedQuantity : 0,
    previousBalance: previousQuantity,
    newBalance: newQuantity,
    reason: `Audited stock adjustment: [${reason}] ${remarks}`,
    relatedTransactionId: adjustmentNumber,
    relatedTransactionType: 'STOCK_ADJUSTMENT',
    user: adjustedBy._id,
  });

  await movement.save({ session });

  // Record AuditLog
  await AuditLog.create({
    action: AuditAction.STOCK_ADJUSTMENT,
    entity: AuditEntity.STOCK_ADJUSTMENT,
    entityId: adjustment._id.toString(),
    performedBy: adjustedBy._id,
    details: {
      adjustmentNumber,
      batchNumber: batch.batchNumber,
      adjustmentType,
      previousQuantity,
      adjustedQuantity,
      newQuantity,
      reason,
      remarks,
    },
  });

  return adjustment;
};
