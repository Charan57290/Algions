import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum PurchasePaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
}

export interface IPurchaseItem {
  medicine: Types.ObjectId;
  batchNumber: string;
  manufacturingDate: Date;
  expiryDate: Date;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  totalAmount: number;
  batch?: Types.ObjectId;
}

export interface IPurchase extends Document {
  purchaseNumber: string;
  supplier: Types.ObjectId;
  purchaseDate: Date;
  supplierInvoiceNumber: string;
  items: IPurchaseItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: PurchasePaymentStatus;
  receivedBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
    },
    manufacturingDate: {
      type: Date,
      required: [true, 'Manufacturing date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Item total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
    },
  },
  { _id: true }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: {
      type: String,
      required: [true, 'Purchase number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
      index: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: [true, 'Supplier invoice number is required'],
      trim: true,
      index: true,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: [(val: IPurchaseItem[]) => val.length > 0, 'Purchase must have at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PurchasePaymentStatus),
      default: PurchasePaymentStatus.PAID,
      index: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member receiving goods is required'],
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

export const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);
export default Purchase;
