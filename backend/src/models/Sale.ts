import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  NET_BANKING = 'NET_BANKING',
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  CANCELLED = 'CANCELLED',
}

export interface ISaleItem {
  medicine: Types.ObjectId;
  batch: Types.ObjectId;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  purchasePriceSnapshot: number; // For gross margin reporting
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface ISale extends Document {
  invoiceNumber: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: ISaleItem[];
  subtotal: number;
  totalDiscount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  cashier: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
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
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit selling price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    purchasePriceSnapshot: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Purchase price snapshot cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    total: {
      type: Number,
      required: [true, 'Item total is required'],
      min: [0, 'Item total cannot be negative'],
    },
  },
  { _id: true }
);

const SaleSchema = new Schema<ISale>(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customer: {
      name: { type: String, trim: true, default: 'Walk-in Customer' },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
    },
    items: {
      type: [SaleItemSchema],
      required: true,
      validate: [(val: ISaleItem[]) => val.length > 0, 'Sale must have at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Total discount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    grandTotal: {
      type: Number,
      required: true,
      min: [0, 'Grand total cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.CASH,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SaleStatus),
      default: SaleStatus.COMPLETED,
      index: true,
    },
    cashier: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Cashier reference is required'],
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

// Indexes for sales analytics and reports
SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ status: 1, createdAt: -1 });

export const Sale: Model<ISale> = mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);
export default Sale;
