import { z } from 'zod';
import { AdjustmentType, AdjustmentReason } from '../models/StockAdjustment.js';

export const returnItemInputSchema = z.object({
  medicineId: z
    .string({ required_error: 'Medicine ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Medicine ID format'),
  batchId: z
    .string({ required_error: 'Batch ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Batch ID format'),
  quantityReturned: z
    .number({ required_error: 'Return quantity is required' })
    .int('Return quantity must be an integer')
    .min(1, 'Return quantity must be at least 1'),
  reason: z
    .string({ required_error: 'Item return reason is required' })
    .min(3, 'Reason must be at least 3 characters')
    .trim(),
  restockable: z.boolean().optional().default(false),
});

export const createReturnSchema = z.object({
  saleId: z
    .string({ required_error: 'Sale ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Sale ID format'),
  items: z.array(returnItemInputSchema).min(1, 'At least one item must be returned'),
  overallReason: z
    .string({ required_error: 'Overall return reason is required' })
    .min(3, 'Overall reason must be at least 3 characters')
    .trim(),
  notes: z.string().trim().optional(),
});

export const createAdjustmentSchema = z.object({
  batchId: z
    .string({ required_error: 'Batch ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Batch ID format'),
  adjustmentType: z.nativeEnum(AdjustmentType, {
    errorMap: () => ({ message: 'Invalid adjustment type: must be INCREASE or DECREASE' }),
  }),
  adjustedQuantity: z
    .number({ required_error: 'Adjusted quantity is required' })
    .int('Adjusted quantity must be an integer')
    .min(1, 'Adjusted quantity must be at least 1'),
  reason: z.nativeEnum(AdjustmentReason, {
    errorMap: () => ({ message: 'Invalid adjustment reason' }),
  }),
  remarks: z
    .string({ required_error: 'Detailed audit remarks are required' })
    .min(5, 'Remarks must be at least 5 characters for compliance audit trail')
    .trim(),
});

export const queryReturnsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const queryAdjustmentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  batchId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  medicineId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  adjustmentType: z.nativeEnum(AdjustmentType).optional(),
  reason: z.nativeEnum(AdjustmentReason).optional(),
});
