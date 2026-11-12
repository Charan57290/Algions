import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User, UserRole } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Supplier, SupplierStatus } from '../models/Supplier.js';
import { Medicine, DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { Sale, SaleStatus } from '../models/Sale.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { AdjustmentType, AdjustmentReason } from '../models/StockAdjustment.js';
import { generateToken } from '../utils/jwt.js';

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_returns_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 7: Returns & Audited Stock Adjustments Suite', () => {
  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;
  let pharmacistUser: any;

  let testCategory: any;
  let testSupplier: any;
  let testMedicine: any;
  let testBatch: any;
  let testSale: any;

  beforeAll(async () => {
    const admin = await User.create({
      name: 'Admin Boss',
      email: 'admin@ret.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });

    pharmacistUser = await User.create({
      name: 'Sarah Pharmacist',
      email: 'sarah@ret.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });

    const customer = await User.create({
      name: 'Customer Dave',
      email: 'dave@ret.test',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
    });

    adminToken = generateToken({ userId: admin._id.toString(), email: admin.email, role: admin.role });
    pharmacistToken = generateToken({ userId: pharmacistUser._id.toString(), email: pharmacistUser.email, role: pharmacistUser.role });
    customerToken = generateToken({ userId: customer._id.toString(), email: customer.email, role: customer.role });

    testCategory = await Category.create({
      name: 'Gastro Returns Test',
      slug: 'gastro-returns-test',
    });

    testSupplier = await Supplier.create({
      supplierCode: 'SUP-RET-01',
      name: 'Returns Test Supplier',
      contactPerson: 'Rep',
      phone: '+91 96666 55555',
      email: 'orders@retsupplier.test',
      status: SupplierStatus.ACTIVE,
    });

    testMedicine = await Medicine.create({
      medicineCode: 'MED-OMEP-RET',
      name: 'Omeprazole 20mg Capsules',
      genericName: 'Omeprazole',
      brandName: 'Prilosec Test',
      category: testCategory._id,
      manufacturer: 'Apex Pharma',
      dosageForm: DosageForm.CAPSULE,
      strength: '20 mg',
      sku: 'SKU-OMEP-RET',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 15,
    });

    const futureExp = new Date();
    futureExp.setMonth(futureExp.getMonth() + 12);

    testBatch = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH-OMEP-R1',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-01-01'),
      expiryDate: futureExp,
      purchasePrice: 20.0,
      sellingPrice: 50.0,
      initialQuantity: 100,
      availableQuantity: 80, // 20 units were sold in testSale below
    });

    // Create a completed sale of 20 units
    testSale = await Sale.create({
      invoiceNumber: 'INV-202611-9999',
      customer: { name: 'Customer Dave', phone: '+91 98765 43210' },
      items: [
        {
          medicine: testMedicine._id,
          batch: testBatch._id,
          medicineName: testMedicine.name,
          batchNumber: testBatch.batchNumber,
          quantity: 20,
          unitPrice: 50.0,
          purchasePriceSnapshot: 20.0,
          discount: 0,
          taxRate: 5,
          taxAmount: 50.0,
          total: 1050.0,
        },
      ],
      subtotal: 1000.0,
      totalDiscount: 0,
      taxRate: 5,
      taxAmount: 50.0,
      grandTotal: 1050.0,
      paymentMethod: 'CASH',
      status: SaleStatus.COMPLETED,
      cashier: pharmacistUser._id,
    });
  });

  // ==========================================
  // Returns API Suite
  // ==========================================
  describe('Customer Returns Endpoints (/api/returns)', () => {
    it('should process restockable return, restore batch inventory, and record stock movement', async () => {
      // Return 5 units out of 20. Restockable = true.
      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          saleId: testSale._id.toString(),
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchId: testBatch._id.toString(),
              quantityReturned: 5,
              reason: 'Doctor changed prescription to 40mg',
              restockable: true,
            },
          ],
          overallReason: 'Prescription modification',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.returnNumber).toMatch(/^RET-\d{6}-\d{4}$/);
      expect(res.body.data.items[0].quantityReturned).toBe(5);
      expect(res.body.data.items[0].restockable).toBe(true);

      // Verify batch stock increased by 5 (from 80 to 85)
      const updatedBatch = await Batch.findById(testBatch._id);
      expect(updatedBatch?.availableQuantity).toBe(85);

      // Verify StockMovement recorded
      const movement = await StockMovement.findOne({
        relatedTransactionId: res.body.data.returnNumber,
        movementType: MovementType.CUSTOMER_RETURN,
      });
      expect(movement).toBeDefined();
      expect(movement?.quantityAdded).toBe(5);
      expect(movement?.previousBalance).toBe(80);
      expect(movement?.newBalance).toBe(85);

      // Verify sale status updated to PARTIALLY_REFUNDED
      const updatedSale = await Sale.findById(testSale._id);
      expect(updatedSale?.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
    });

    it('should quarantine non-restockable return without increasing sellable stock', async () => {
      // Return 3 units. Restockable = false (damaged foil blister).
      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          saleId: testSale._id.toString(),
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchId: testBatch._id.toString(),
              quantityReturned: 3,
              reason: 'Customer damaged outer blister packaging',
              restockable: false,
            },
          ],
          overallReason: 'Damaged item return',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].restockable).toBe(false);

      // Verify batch stock DID NOT INCREASE (remains 85)
      const updatedBatch = await Batch.findById(testBatch._id);
      expect(updatedBatch?.availableQuantity).toBe(85);

      // Verify DAMAGED_STOCK movement recorded
      const movement = await StockMovement.findOne({
        relatedTransactionId: res.body.data.returnNumber,
        movementType: MovementType.DAMAGED_STOCK,
      });
      expect(movement).toBeDefined();
      expect(movement?.quantityAdded).toBe(0);
    });

    it('should reject return if requested quantity exceeds original purchase limit', async () => {
      // Originally purchased: 20 units.
      // Already returned: 5 + 3 = 8 units.
      // Remaining returnable: 12 units.
      // Attempting to return 15 units must fail with 400!
      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          saleId: testSale._id.toString(),
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchId: testBatch._id.toString(),
              quantityReturned: 15,
              reason: 'Excessive return attempt',
            },
          ],
          overallReason: 'Invalid return',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('maximum returnable');
    });

    it('should complete final return and mark sale status as fully REFUNDED', async () => {
      // Return the remaining 12 units
      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          saleId: testSale._id.toString(),
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchId: testBatch._id.toString(),
              quantityReturned: 12,
              reason: 'Final remaining return',
              restockable: true,
            },
          ],
          overallReason: 'Full refund completion',
        });

      expect(res.status).toBe(201);

      // Verify sale status is now REFUNDED
      const updatedSale = await Sale.findById(testSale._id);
      expect(updatedSale?.status).toBe(SaleStatus.REFUNDED);

      // Attempting any further return on this sale must be rejected
      const furtherRes = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          saleId: testSale._id.toString(),
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchId: testBatch._id.toString(),
              quantityReturned: 1,
              reason: 'Late return',
            },
          ],
          overallReason: 'Post-refund attempt',
        });

      expect(furtherRes.status).toBe(400);
      expect(furtherRes.body.message).toContain('fully returned and refunded');
    });
  });

  // ==========================================
  // Stock Adjustment API Suite
  // ==========================================
  describe('Stock Adjustments Endpoints (/api/adjustments)', () => {
    it('should process audited stock INCREASE adjustment', async () => {
      // Current batch stock = 85 + 12 = 97.
      // Increase by 10 units due to STOCKTAKE_CORRECTION.
      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          batchId: testBatch._id.toString(),
          adjustmentType: AdjustmentType.INCREASE,
          adjustedQuantity: 10,
          reason: AdjustmentReason.STOCKTAKE_CORRECTION,
          remarks: 'Found unopened surplus pack during monthly physical count audit',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adjustmentNumber).toMatch(/^ADJ-\d{6}-\d{4}$/);
      expect(res.body.data.previousQuantity).toBe(97);
      expect(res.body.data.newQuantity).toBe(107);

      // Verify Batch stock updated
      const updatedBatch = await Batch.findById(testBatch._id);
      expect(updatedBatch?.availableQuantity).toBe(107);

      // Verify StockMovement recorded
      const movement = await StockMovement.findOne({
        relatedTransactionId: res.body.data.adjustmentNumber,
      });
      expect(movement).toBeDefined();
      expect(movement?.quantityAdded).toBe(10);
      expect(movement?.newBalance).toBe(107);
    });

    it('should process audited stock DECREASE adjustment', async () => {
      // Decrease by 5 units due to DAMAGED_GOODS.
      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          batchId: testBatch._id.toString(),
          adjustmentType: AdjustmentType.DECREASE,
          adjustedQuantity: 5,
          reason: AdjustmentReason.DAMAGED_GOODS,
          remarks: 'Water leakage damaged bottom shelf carton during storm',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.previousQuantity).toBe(107);
      expect(res.body.data.newQuantity).toBe(102);

      const updatedBatch = await Batch.findById(testBatch._id);
      expect(updatedBatch?.availableQuantity).toBe(102);
    });

    it('should reject DECREASE adjustment if quantity exceeds available stock (negative stock prevention)', async () => {
      // Current stock = 102. Decreasing by 150 must fail!
      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          batchId: testBatch._id.toString(),
          adjustmentType: AdjustmentType.DECREASE,
          adjustedQuantity: 150,
          reason: AdjustmentReason.THEFT_OR_LOSS,
          remarks: 'Erroneous massive reduction attempt beyond available stock',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Negative stock is strictly prohibited');
    });

    it('should reject adjustment if remarks are missing or shorter than 5 characters', async () => {
      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          batchId: testBatch._id.toString(),
          adjustmentType: AdjustmentType.INCREASE,
          adjustedQuantity: 5,
          reason: AdjustmentReason.INVENTORY_COUNT_DISCREPANCY,
          remarks: 'Bad', // Less than 5 chars
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should deny Customers from performing stock adjustments (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          batchId: testBatch._id.toString(),
          adjustmentType: AdjustmentType.INCREASE,
          adjustedQuantity: 5,
          reason: AdjustmentReason.STOCKTAKE_CORRECTION,
          remarks: 'Hacker customer adjustment attempt',
        });

      expect(res.status).toBe(403);
    });
  });
});
