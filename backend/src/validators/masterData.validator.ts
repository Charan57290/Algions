import { z } from 'zod';
import { DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { SupplierStatus } from '../models/Supplier.js';

// Category Validators
export const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name cannot exceed 100 characters')
    .trim(),
  description: z.string().max(500).trim().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

// Supplier Validators
export const createSupplierSchema = z.object({
  supplierCode: z
    .string({ required_error: 'Supplier code is required' })
    .min(2, 'Supplier code must be at least 2 characters')
    .max(20)
    .trim()
    .toUpperCase(),
  name: z
    .string({ required_error: 'Supplier name is required' })
    .min(2, 'Supplier name must be at least 2 characters')
    .max(150)
    .trim(),
  contactPerson: z
    .string({ required_error: 'Contact person is required' })
    .min(2)
    .trim(),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .min(5)
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
  address: z
    .object({
      street: z.string().trim().optional(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      postalCode: z.string().trim().optional(),
      country: z.string().trim().optional().default('India'),
    })
    .optional(),
  gstin: z.string().trim().toUpperCase().optional(),
  status: z
    .nativeEnum(SupplierStatus, { errorMap: () => ({ message: 'Invalid supplier status' }) })
    .optional()
    .default(SupplierStatus.ACTIVE),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Medicine Validators
export const createMedicineSchema = z.object({
  medicineCode: z
    .string({ required_error: 'Medicine code is required' })
    .min(2, 'Medicine code must be at least 2 characters')
    .max(30)
    .trim()
    .toUpperCase(),
  name: z
    .string({ required_error: 'Medicine name is required' })
    .min(2, 'Medicine name must be at least 2 characters')
    .max(200)
    .trim(),
  genericName: z
    .string({ required_error: 'Generic name is required' })
    .min(2)
    .trim(),
  brandName: z
    .string({ required_error: 'Brand name is required' })
    .min(2)
    .trim(),
  category: z
    .string({ required_error: 'Category ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ObjectId format'),
  manufacturer: z
    .string({ required_error: 'Manufacturer is required' })
    .min(2)
    .trim(),
  description: z.string().max(1000).trim().optional(),
  dosageForm: z.nativeEnum(DosageForm, {
    errorMap: () => ({ message: 'Invalid dosage form' }),
  }),
  strength: z
    .string({ required_error: 'Strength is required (e.g. 500mg)' })
    .min(1)
    .trim(),
  barcode: z.string().trim().optional(),
  sku: z
    .string({ required_error: 'SKU is required' })
    .min(2)
    .trim()
    .toUpperCase(),
  unitOfMeasurement: z.nativeEnum(UnitOfMeasurement, {
    errorMap: () => ({ message: 'Invalid unit of measurement' }),
  }),
  reorderThreshold: z
    .number({ required_error: 'Reorder threshold is required' })
    .int('Reorder threshold must be an integer')
    .min(0, 'Reorder threshold cannot be negative')
    .default(20),
  isActive: z.boolean().optional().default(true),
});

export const updateMedicineSchema = createMedicineSchema.partial();
