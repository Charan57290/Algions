import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { Medicine, DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { Category } from '../models/Category.js';
import { Supplier } from '../models/Supplier.js';
import { User, UserRole } from '../models/User.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import {
  previewFefoAllocation,
  executeFefoDeduction,
  InsufficientStockError,
} from './fefo.service.js';

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_fefo_test';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 5: FEFO (First-Expiry-First-Out) Inventory Engine Suite', () => {
  let testUser: any;
  let testMedicine: any;
  let testSupplier: any;

  let batchEarly: any;
  let batchLate: any;
  let batchExpired: any;
  let batchZeroStock: any;

  beforeAll(async () => {
    testUser = await User.create({
      name: 'Cashier Staff',
      email: 'cashier@fefo.test',
      password: 'Password@123',
      role: UserRole.PHARMACIST,
    });

    const category = await Category.create({
      name: 'Analgesics FEFO Test',
      slug: 'analgesics-fefo-test',
    });

    testSupplier = await Supplier.create({
      supplierCode: 'SUP-FEFO-01',
      name: 'FEFO Test Supplier',
      contactPerson: 'Vendor Rep',
      phone: '+91 91111 22222',
      email: 'vendor@fefo.test',
    });

    testMedicine = await Medicine.create({
      medicineCode: 'MED-FEFO-01',
      name: 'Paracetamol FEFO 500mg',
      genericName: 'Paracetamol',
      brandName: 'Crocin Test',
      category: category._id,
      manufacturer: 'Pharma Lab',
      dosageForm: DosageForm.TABLET,
      strength: '500 mg',
      sku: 'SKU-FEFO-PARA',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 20,
    });

    const now = new Date();
    const expiryEarly = new Date(now);
    expiryEarly.setMonth(now.getMonth() + 2); // 2 months from now (Earliest Active)

    const expiryLate = new Date(now);
    expiryLate.setMonth(now.getMonth() + 8); // 8 months from now (Later Active)

    const expiryPast = new Date(now);
    expiryPast.setDate(now.getDate() - 10); // Expired 10 days ago

    const expiryFar = new Date(now);
    expiryFar.setMonth(now.getMonth() + 12);

    // Batch A: Expiry in 2 months, 20 units available
    batchEarly = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH-EARLY-20',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-01-01'),
      expiryDate: expiryEarly,
      purchasePrice: 10,
      sellingPrice: 20,
      initialQuantity: 20,
      availableQuantity: 20,
    });

    // Batch B: Expiry in 8 months, 50 units available
    batchLate = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH-LATE-50',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-03-01'),
      expiryDate: expiryLate,
      purchasePrice: 12,
      sellingPrice: 22,
      initialQuantity: 50,
      availableQuantity: 50,
    });

    // Batch C (Expired): Expired 10 days ago, 30 units physically present
    batchExpired = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH-EXPIRED-30',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: expiryPast,
      purchasePrice: 8,
      sellingPrice: 18,
      initialQuantity: 30,
      availableQuantity: 30,
    });

    // Batch D (Zero Stock): Expiry in 12 months, 0 units available
    batchZeroStock = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH-EMPTY-00',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-05-01'),
      expiryDate: expiryFar,
      purchasePrice: 15,
      sellingPrice: 25,
      initialQuantity: 10,
      availableQuantity: 0,
    });
  });

  describe('FEFO Preview (Non-mutating)', () => {
    it('should allocate from earliest-expiring batch first without touching later batches', async () => {
      // Customer requests 15 units. BatchEarly has 20 units.
      const preview = await previewFefoAllocation(testMedicine._id.toString(), 15);

      expect(preview.isSufficient).toBe(true);
      expect(preview.totalAllocated).toBe(15);
      expect(preview.allocations.length).toBe(1);
      expect(preview.allocations[0].batchNumber).toBe('BATCH-EARLY-20');
      expect(preview.allocations[0].allocatedQuantity).toBe(15);
    });

    it('should split allocation across multiple eligible batches in strict FEFO order', async () => {
      // Customer requests 35 units.
      // Expected: 20 units from BatchEarly (depleting it), 15 units from BatchLate.
      // Strictly 0 units from BatchExpired and BatchZeroStock.
      const preview = await previewFefoAllocation(testMedicine._id.toString(), 35);

      expect(preview.isSufficient).toBe(true);
      expect(preview.totalAllocated).toBe(35);
      expect(preview.allocations.length).toBe(2);

      // 1st allocation: Earliest active batch
      expect(preview.allocations[0].batchNumber).toBe('BATCH-EARLY-20');
      expect(preview.allocations[0].allocatedQuantity).toBe(20);

      // 2nd allocation: Next earliest active batch
      expect(preview.allocations[1].batchNumber).toBe('BATCH-LATE-50');
      expect(preview.allocations[1].allocatedQuantity).toBe(15);
    });

    it('should strictly exclude expired batches from eligible inventory count', async () => {
      // Total eligible units = 20 (BatchEarly) + 50 (BatchLate) = 70 units.
      // If customer asks for 80 units, even though expired batch has 30 units (70 + 30 = 100),
      // it MUST report insufficient stock with remaining deficit of 10!
      const preview = await previewFefoAllocation(testMedicine._id.toString(), 80);

      expect(preview.isSufficient).toBe(false);
      expect(preview.totalAllocated).toBe(70);
      expect(preview.remainingDeficit).toBe(10);
      // Verify expired batch is not in allocations
      expect(preview.allocations.some((a) => a.batchNumber === 'BATCH-EXPIRED-30')).toBe(false);
    });
  });

  describe('FEFO Execution & Stock Movement Ledger', () => {
    it('should execute deduction, mutate batch balances, and generate audit stock movements', async () => {
      // Request 30 units from medicine.
      // Before: BatchEarly = 20, BatchLate = 50.
      // After:  BatchEarly = 0,  BatchLate = 40.
      const allocations = await executeFefoDeduction(
        testMedicine._id.toString(),
        30,
        'INV-TEST-0001',
        'POS_SALE',
        testUser
      );

      expect(allocations.length).toBe(2);
      expect(allocations[0].batchNumber).toBe('BATCH-EARLY-20');
      expect(allocations[0].allocatedQuantity).toBe(20);
      expect(allocations[1].batchNumber).toBe('BATCH-LATE-50');
      expect(allocations[1].allocatedQuantity).toBe(10);

      // Verify Batch balances in database
      const [updatedEarly, updatedLate] = await Promise.all([
        Batch.findById(batchEarly._id),
        Batch.findById(batchLate._id),
      ]);

      expect(updatedEarly?.availableQuantity).toBe(0);
      expect(updatedLate?.availableQuantity).toBe(40);

      // Verify StockMovement audit records
      const movements = await StockMovement.find({
        relatedTransactionId: 'INV-TEST-0001',
      }).sort({ createdAt: 1 });

      expect(movements.length).toBe(2);

      // Movement for Batch A
      expect(movements[0].batch.toString()).toBe(batchEarly._id.toString());
      expect(movements[0].movementType).toBe(MovementType.SALE);
      expect(movements[0].previousBalance).toBe(20);
      expect(movements[0].quantityRemoved).toBe(20);
      expect(movements[0].newBalance).toBe(0);

      // Movement for Batch B
      expect(movements[1].batch.toString()).toBe(batchLate._id.toString());
      expect(movements[1].movementType).toBe(MovementType.SALE);
      expect(movements[1].previousBalance).toBe(50);
      expect(movements[1].quantityRemoved).toBe(10);
      expect(movements[1].newBalance).toBe(40);
    });

    it('should reject transaction and throw InsufficientStockError when requested quantity exceeds available stock', async () => {
      // Current available: BatchEarly = 0, BatchLate = 40. Total = 40.
      // Requesting 45 units must throw InsufficientStockError!
      await expect(
        executeFefoDeduction(
          testMedicine._id.toString(),
          45,
          'INV-FAIL-0001',
          'POS_SALE',
          testUser
        )
      ).rejects.toThrow(InsufficientStockError);

      // Verify no stock was deducted on failure
      const checkLate = await Batch.findById(batchLate._id);
      expect(checkLate?.availableQuantity).toBe(40);
    });
  });
});
