import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IBatch extends Document {
  medicine: Types.ObjectId;
  batchNumber: string;
  supplier: Types.ObjectId;
  manufacturingDate: Date;
  expiryDate: Date;
  purchasePrice: number;
  sellingPrice: number;
  initialQuantity: number;
  availableQuantity: number;
  purchase?: Types.ObjectId;
  isExpired(): boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true,
    },
    manufacturingDate: {
      type: Date,
      required: [true, 'Manufacturing date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase unit price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling unit price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    initialQuantity: {
      type: Number,
      required: [true, 'Initial quantity is required'],
      min: [0, 'Initial quantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: [true, 'Available quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      default: 0,
    },
    purchase: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: A medicine cannot have duplicate batch numbers
BatchSchema.index({ medicine: 1, batchNumber: 1 }, { unique: true });

// Highly optimized compound index for FEFO allocation query:
// Finding eligible sellable batches: { medicine: id, availableQuantity: { $gt: 0 }, expiryDate: { $gt: today } } sorted by expiryDate: 1
BatchSchema.index({ medicine: 1, expiryDate: 1, availableQuantity: 1 });

// Helper instance method to check whether batch is expired
BatchSchema.methods.isExpired = function (): boolean {
  return new Date() > new Date(this.expiryDate);
};

export const Batch: Model<IBatch> = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
export default Batch;
