import { z } from 'zod';
import { PurchasePaymentStatus } from '../models/Purchase.js';

export const createBatchSchema = z.object({
  medicine: z.string({ required_error: 'Medicine ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Medicine ID format'),
  batchNumber: z
    .string({ required_error: 'Batch number is required' })
    .min(2, 'Batch number must be at least 2 characters')
    .max(50)
    .trim()
    .toUpperCase(),
  supplier: z.string({ required_error: 'Supplier ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Supplier ID format'),
  manufacturingDate: z.string({ required_error: 'Manufacturing date is required' }).datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  expiryDate: z.string({ required_error: 'Expiry date is required' }).datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  purchasePrice: z.number({ required_error: 'Purchase price is required' }).min(0, 'Purchase price cannot be negative'),
  sellingPrice: z.number({ required_error: 'Selling price is required' }).min(0, 'Selling price cannot be negative'),
  initialQuantity: z.number({ required_error: 'Initial quantity is required' }).int().min(1, 'Initial quantity must be at least 1'),
  availableQuantity: z.number().int().min(0, 'Available quantity cannot be negative').optional(),
});

export const purchaseItemSchema = z.object({
  medicineId: z.string({ required_error: 'Medicine ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Medicine ID format'),
  batchNumber: z.string({ required_error: 'Batch number is required' }).min(2).max(50).trim().toUpperCase(),
  manufacturingDate: z.string({ required_error: 'Manufacturing date is required' }),
  expiryDate: z.string({ required_error: 'Expiry date is required' }),
  quantity: z.number({ required_error: 'Quantity is required' }).int().min(1, 'Quantity must be at least 1'),
  purchasePrice: z.number({ required_error: 'Purchase price is required' }).min(0),
  sellingPrice: z.number({ required_error: 'Selling price is required' }).min(0),
});

export const receivePurchaseSchema = z.object({
  supplierId: z.string({ required_error: 'Supplier ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Supplier ID format'),
  supplierInvoiceNumber: z
    .string({ required_error: 'Supplier invoice number is required' })
    .min(2)
    .trim(),
  purchaseDate: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required in a purchase order'),
  taxAmount: z.number().min(0).optional().default(0),
  paymentStatus: z.nativeEnum(PurchasePaymentStatus).optional().default(PurchasePaymentStatus.PAID),
  notes: z.string().trim().optional(),
});

export const fefoPreviewQuerySchema = z.object({
  medicine: z.string({ required_error: 'Medicine ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Medicine ID format'),
  quantity: z.coerce.number({ required_error: 'Quantity is required' }).int().min(1, 'Quantity must be at least 1'),
});

export const nearExpiryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});
