import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import {
  User,
  UserRole,
  Category,
  Supplier,
  SupplierStatus,
  Medicine,
  DosageForm,
  UnitOfMeasurement,
  Batch,
  StockMovement,
  MovementType,
  StockAdjustment,
  AdjustmentType,
  AdjustmentReason,
} from './index.js';

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_management_test';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Mongoose Models & Schemas Validation Suite', () => {
  let createdUser: any;
  let createdCategory: any;
  let createdSupplier: any;
  let createdMedicine: any;
  let createdBatch: any;

  describe('User Model', () => {
    it('should hash the password before saving and correctly compare passwords', async () => {
      createdUser = await User.create({
        name: 'Test Administrator',
        email: 'testadmin@pharmacare.com',
        password: 'SecurePassword@123',
        role: UserRole.ADMIN,
      });

      expect(createdUser._id).toBeDefined();
      expect(createdUser.password).not.toBe('SecurePassword@123'); // Must be hashed

      const isMatch = await createdUser.comparePassword('SecurePassword@123');
      expect(isMatch).toBe(true);

      const isWrong = await createdUser.comparePassword('WrongPassword');
      expect(isWrong).toBe(false);
    });

    it('should reject invalid email formats', async () => {
      await expect(
        User.create({
          name: 'Invalid User',
          email: 'invalid-email-string',
          password: 'Password@123',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate email addresses', async () => {
      await expect(
        User.create({
          name: 'Duplicate Admin',
          email: 'testadmin@pharmacare.com',
          password: 'Password@123',
        })
      ).rejects.toThrow();
    });
  });

  describe('Category Model', () => {
    it('should create category and automatically generate slug', async () => {
      createdCategory = await Category.create({
        name: 'Cardiovascular Therapies',
        description: 'Heart medication',
      });

      expect(createdCategory._id).toBeDefined();
      expect(createdCategory.slug).toBe('cardiovascular-therapies');
      expect(createdCategory.isActive).toBe(true);
    });

    it('should reject duplicate category names', async () => {
      await expect(
        Category.create({
          name: 'Cardiovascular Therapies',
        })
      ).rejects.toThrow();
    });
  });

  describe('Supplier Model', () => {
    it('should create supplier with complete details', async () => {
      createdSupplier = await Supplier.create({
        supplierCode: 'SUP-TEST-001',
        name: 'Apex Test Healthcare',
        contactPerson: 'John Doe',
        phone: '+91 99999 88888',
        email: 'contact@apextest.fictional',
        status: SupplierStatus.ACTIVE,
      });

      expect(createdSupplier._id).toBeDefined();
      expect(createdSupplier.supplierCode).toBe('SUP-TEST-001');
    });

    it('should enforce unique supplier codes', async () => {
      await expect(
        Supplier.create({
          supplierCode: 'SUP-TEST-001',
          name: 'Another Supplier',
          contactPerson: 'Jane Doe',
          phone: '+91 99999 77777',
          email: 'jane@test.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('Medicine Model', () => {
    it('should create medicine SKU with valid attributes', async () => {
      createdMedicine = await Medicine.create({
        medicineCode: 'MED-PARA-TEST',
        name: 'Paracetamol Test 500mg',
        genericName: 'Paracetamol',
        brandName: 'TestCalpol',
        category: createdCategory._id,
        manufacturer: 'Apex Test Labs',
        dosageForm: DosageForm.TABLET,
        strength: '500 mg',
        sku: 'SKU-PARA-TEST',
        barcode: '999123456789',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 20,
      });

      expect(createdMedicine._id).toBeDefined();
      expect(createdMedicine.sku).toBe('SKU-PARA-TEST');
      expect(createdMedicine.reorderThreshold).toBe(20);
    });

    it('should reject negative reorder threshold', async () => {
      await expect(
        Medicine.create({
          medicineCode: 'MED-FAIL',
          name: 'Fail Medicine',
          genericName: 'Generic',
          brandName: 'Brand',
          category: createdCategory._id,
          manufacturer: 'Lab',
          dosageForm: DosageForm.TABLET,
          strength: '10mg',
          sku: 'SKU-FAIL',
          reorderThreshold: -5,
        })
      ).rejects.toThrow();
    });
  });

  describe('Batch Model', () => {
    it('should create batch and correctly evaluate expiry status', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      createdBatch = await Batch.create({
        medicine: createdMedicine._id,
        batchNumber: 'BATCH-TEST-001',
        supplier: createdSupplier._id,
        manufacturingDate: new Date('2025-01-01'),
        expiryDate: futureDate,
        purchasePrice: 15.0,
        sellingPrice: 30.0,
        initialQuantity: 100,
        availableQuantity: 100,
      });

      expect(createdBatch._id).toBeDefined();
      expect(createdBatch.isExpired()).toBe(false);
    });

    it('should correctly flag expired batches', async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 2);

      const expiredBatch = await Batch.create({
        medicine: createdMedicine._id,
        batchNumber: 'BATCH-EXPIRED-TEST',
        supplier: createdSupplier._id,
        manufacturingDate: new Date('2024-01-01'),
        expiryDate: pastDate,
        purchasePrice: 10.0,
        sellingPrice: 20.0,
        initialQuantity: 50,
        availableQuantity: 50,
      });

      expect(expiredBatch.isExpired()).toBe(true);
    });

    it('should reject negative available quantities', async () => {
      await expect(
        Batch.create({
          medicine: createdMedicine._id,
          batchNumber: 'BATCH-NEGATIVE',
          supplier: createdSupplier._id,
          manufacturingDate: new Date(),
          expiryDate: new Date(),
          purchasePrice: 10,
          sellingPrice: 20,
          initialQuantity: 10,
          availableQuantity: -5, // Illegal negative quantity
        })
      ).rejects.toThrow();
    });
  });

  describe('StockMovement Model', () => {
    it('should record an opening stock movement ledger entry', async () => {
      const movement = await StockMovement.create({
        medicine: createdMedicine._id,
        batch: createdBatch._id,
        movementType: MovementType.OPENING_STOCK,
        quantityAdded: 100,
        quantityRemoved: 0,
        previousBalance: 0,
        newBalance: 100,
        reason: 'Initial opening stock ledger entry',
        user: createdUser._id,
      });

      expect(movement._id).toBeDefined();
      expect(movement.movementType).toBe(MovementType.OPENING_STOCK);
      expect(movement.newBalance).toBe(100);
    });
  });

  describe('StockAdjustment Model', () => {
    it('should record an audited stock adjustment with mandatory reason', async () => {
      const adjustment = await StockAdjustment.create({
        adjustmentNumber: 'ADJ-TEST-0001',
        medicine: createdMedicine._id,
        batch: createdBatch._id,
        adjustmentType: AdjustmentType.DECREASE,
        previousQuantity: 100,
        adjustedQuantity: 5,
        newQuantity: 95,
        reason: AdjustmentReason.DAMAGED_GOODS,
        remarks: 'Found damaged packaging during routine stock inspection',
        adjustedBy: createdUser._id,
      });

      expect(adjustment._id).toBeDefined();
      expect(adjustment.reason).toBe(AdjustmentReason.DAMAGED_GOODS);
      expect(adjustment.newQuantity).toBe(95);
    });
  });
});
