import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IReturnItem {
  medicine: Types.ObjectId;
  batch: Types.ObjectId;
  medicineName: string;
  batchNumber: string;
  quantityReturned: number;
  unitRefundPrice: number;
  refundAmount: number;
  reason: string;
  restockable: boolean; // Only if undamaged and not expired
}

export interface IReturn extends Document {
  returnNumber: string;
  sale: Types.ObjectId;
  invoiceNumber: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  items: IReturnItem[];
  totalRefundAmount: number;
  overallReason: string;
  processedBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>(
  {
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch reference is required'],
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    quantityReturned: {
      type: Number,
      required: [true, 'Return quantity is required'],
      min: [1, 'Return quantity must be at least 1'],
    },
    unitRefundPrice: {
      type: Number,
      required: [true, 'Refund price is required'],
      min: [0, 'Refund price cannot be negative'],
    },
    refundAmount: {
      type: Number,
      required: [true, 'Refund amount is required'],
      min: [0, 'Refund amount cannot be negative'],
    },
    reason: {
      type: String,
      required: [true, 'Item return reason is required'],
      trim: true,
    },
    restockable: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const ReturnSchema = new Schema<IReturn>(
  {
    returnNumber: {
      type: String,
      required: [true, 'Return number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    sale: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      required: [true, 'Original sale reference is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Original invoice number is required'],
      trim: true,
      index: true,
    },
    customer: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    items: {
      type: [ReturnItemSchema],
      required: true,
      validate: [(val: IReturnItem[]) => val.length > 0, 'Return must have at least one item'],
    },
    totalRefundAmount: {
      type: Number,
      required: true,
      min: [0, 'Total refund amount cannot be negative'],
    },
    overallReason: {
      type: String,
      required: [true, 'Overall return reason is required'],
      trim: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member processing return is required'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ReturnSchema.index({ createdAt: -1 });

export const Return: Model<IReturn> =
  mongoose.models.Return || mongoose.model<IReturn>('Return', ReturnSchema);
export default Return;
