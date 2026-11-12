import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum MovementType {
  OPENING_STOCK = 'OPENING_STOCK',
  PURCHASE_RECEIVED = 'PURCHASE_RECEIVED',
  SALE = 'SALE',
  CUSTOMER_RETURN = 'CUSTOMER_RETURN',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  DAMAGED_STOCK = 'DAMAGED_STOCK',
  EXPIRED_STOCK = 'EXPIRED_STOCK',
}

export interface IStockMovement extends Document {
  medicine: Types.ObjectId;
  batch: Types.ObjectId;
  movementType: MovementType;
  quantityAdded: number;
  quantityRemoved: number;
  previousBalance: number;
  newBalance: number;
  reason: string;
  relatedTransactionId?: string;
  relatedTransactionType?: string;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
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
    movementType: {
      type: String,
      enum: Object.values(MovementType),
      required: [true, 'Movement type is required'],
      index: true,
    },
    quantityAdded: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity added cannot be negative'],
    },
    quantityRemoved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity removed cannot be negative'],
    },
    previousBalance: {
      type: Number,
      required: [true, 'Previous balance is required'],
      min: [0, 'Previous balance cannot be negative'],
    },
    newBalance: {
      type: Number,
      required: [true, 'New balance is required'],
      min: [0, 'New balance cannot be negative'],
    },
    reason: {
      type: String,
      required: [true, 'Movement reason/remarks is required'],
      trim: true,
    },
    relatedTransactionId: {
      type: String,
      trim: true,
      index: true,
    },
    relatedTransactionType: {
      type: String,
      trim: true,
    },
    user: {
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

// Indexes for reconciliation and ledger querying
StockMovementSchema.index({ batch: 1, createdAt: -1 });
StockMovementSchema.index({ medicine: 1, createdAt: -1 });
StockMovementSchema.index({ movementType: 1, createdAt: -1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement || mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
export default StockMovement;
