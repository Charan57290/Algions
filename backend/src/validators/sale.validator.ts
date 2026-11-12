import { z } from 'zod';
import { PaymentMethod } from '../models/Sale.js';

export const saleItemSchema = z.object({
  medicineId: z
    .string({ required_error: 'Medicine ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Medicine ID format'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1'),
  batchId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Batch ID format')
    .optional(), // Optional: if omitted, FEFO allocates automatically
  discountPercent: z.number().min(0).max(100).optional().default(0),
});

export const createSaleSchema = z.object({
  customer: z
    .object({
      name: z.string().trim().optional().default('Walk-in Customer'),
      phone: z.string().trim().optional(),
      email: z.string().email().trim().optional(),
    })
    .optional()
    .default({ name: 'Walk-in Customer' }),
  items: z.array(saleItemSchema).min(1, 'Sale must contain at least one item'),
  totalDiscount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(5), // 5% default pharmaceutical GST
  paymentMethod: z
    .nativeEnum(PaymentMethod, { errorMap: () => ({ message: 'Invalid payment method' }) })
    .default(PaymentMethod.CASH),
  idempotencyKey: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const querySalesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  cashier: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  search: z.string().optional(),
});
