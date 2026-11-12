import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum AdjustmentType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export enum AdjustmentReason {
  INVENTORY_COUNT_DISCREPANCY = 'INVENTORY_COUNT_DISCREPANCY',
  DAMAGED_GOODS = 'DAMAGED_GOODS',
  EXPIRED_STOCK = 'EXPIRED_STOCK',
  THEFT_OR_LOSS = 'THEFT_OR_LOSS',
  STOCKTAKE_CORRECTION = 'STOCKTAKE_CORRECTION',
  CUSTOMER_RETURN_RESTOCK = 'CUSTOMER_RETURN_RESTOCK',
  OTHER = 'OTHER',
}

export interface IStockAdjustment extends Document {
  adjustmentNumber: string;
  medicine: Types.ObjectId;
  batch: Types.ObjectId;
  adjustmentType: AdjustmentType;
  previousQuantity: number;
  adjustedQuantity: number;
  newQuantity: number;
  reason: AdjustmentReason;
  remarks: string;
  adjustedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    adjustmentNumber: {
      type: String,
      required: [true, 'Adjustment number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
      index: true,
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch reference is required'],
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: Object.values(AdjustmentType),
      required: [true, 'Adjustment type is required'],
    },
    previousQuantity: {
      type: Number,
      required: [true, 'Previous quantity is required'],
      min: [0, 'Previous quantity cannot be negative'],
    },
    adjustedQuantity: {
      type: Number,
      required: [true, 'Adjusted quantity delta is required'],
      min: [1, 'Adjusted quantity must be at least 1'],
    },
    newQuantity: {
      type: Number,
      required: [true, 'New quantity is required'],
      min: [0, 'New quantity cannot be negative'],
    },
    reason: {
      type: String,
      enum: Object.values(AdjustmentReason),
      required: [true, 'Adjustment reason is required'],
    },
    remarks: {
      type: String,
      required: [true, 'Detailed remarks are required for audit trail'],
      trim: true,
    },
    adjustedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User responsible is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

StockAdjustmentSchema.index({ batch: 1, createdAt: -1 });
StockAdjustmentSchema.index({ createdAt: -1 });

export const StockAdjustment: Model<IStockAdjustment> =
  mongoose.models.StockAdjustment || mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
export default StockAdjustment;
