import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User, UserRole } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Supplier, SupplierStatus } from '../models/Supplier.js';
import { Medicine, DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { generateToken } from '../utils/jwt.js';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_sales_routes_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 6: Sales & POS Billing API Suite', () => {
  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;

  let testCategory: any;
  let testSupplier: any;
  let testMedicine: any;

  let batchEarly: any;
  let batchLate: any;
  let batchExpired: any;

  beforeAll(async () => {
    const admin = await User.create({
      name: 'Admin Boss',
      email: 'admin@sales.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });

    const pharmacist = await User.create({
      name: 'Cashier Pharmacist',
      email: 'cashier@sales.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });

    const customer = await User.create({
      name: 'John Patient',
      email: 'patient@sales.test',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
    });

    adminToken = generateToken({ userId: admin._id.toString(), email: admin.email, role: admin.role });
    pharmacistToken = generateToken({ userId: pharmacist._id.toString(), email: pharmacist.email, role: pharmacist.role });
    customerToken = generateToken({ userId: customer._id.toString(), email: customer.email, role: customer.role });

    testCategory = await Category.create({
      name: 'Antipyretics POS Test',
      slug: 'antipyretics-pos-test',
    });

    testSupplier = await Supplier.create({
      supplierCode: 'SUP-POS-01',
      name: 'POS Pharma Vendor',
      contactPerson: 'Vendor Rep',
      phone: '+91 95555 44444',
      email: 'orders@posvendor.test',
      status: SupplierStatus.ACTIVE,
    });

    testMedicine = await Medicine.create({
      medicineCode: 'MED-PARA-POS',
      name: 'Paracetamol POS 500mg',
      genericName: 'Paracetamol',
      brandName: 'Calpol Test',
      category: testCategory._id,
      manufacturer: 'Apex Pharma',
      dosageForm: DosageForm.TABLET,
      strength: '500 mg',
      sku: 'SKU-PARA-POS',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 20,
    });

    const now = new Date();
    const expiryEarly = new Date(now);
    expiryEarly.setMonth(now.getMonth() + 3);

    const expiryLate = new Date(now);
    expiryLate.setMonth(now.getMonth() + 9);

    const expiryPast = new Date(now);
    expiryPast.setDate(now.getDate() - 10);

    // Batch A: Expires in 3 months, 25 units available (Price: Cost 10, Sell 25)
    batchEarly = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'POS-BATCH-EARLY-25',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-01-01'),
      expiryDate: expiryEarly,
      purchasePrice: 10.0,
      sellingPrice: 25.0,
      initialQuantity: 25,
      availableQuantity: 25,
    });

    // Batch B: Expires in 9 months, 50 units available (Price: Cost 11, Sell 25)
    batchLate = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'POS-BATCH-LATE-50',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-02-01'),
      expiryDate: expiryLate,
      purchasePrice: 11.0,
      sellingPrice: 25.0,
      initialQuantity: 50,
      availableQuantity: 50,
    });

    // Batch Expired: Expired 10 days ago, 20 units
    batchExpired = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'POS-BATCH-EXP-20',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: expiryPast,
      purchasePrice: 9.0,
      sellingPrice: 20.0,
      initialQuantity: 20,
      availableQuantity: 20,
    });
  });

  describe('POST /api/sales (POS Checkout & Automatic FEFO)', () => {
    let createdSaleId: string;

    it('should complete sale, allocate batches in strict FEFO order, deduct stock, and generate invoice', async () => {
      // Customer purchases 30 units of Paracetamol.
      // BatchEarly has 25 units -> 25 deducted (balance: 0).
      // BatchLate has 50 units -> 5 deducted (balance: 45).
      // Total price: 30 * 25.0 = 750 subtotal. Tax: 5% = 37.5. Grand total: 787.5.
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          customer: {
            name: 'Vikram Singh',
            phone: '+91 98888 11111',
          },
          items: [
            {
              medicineId: testMedicine._id.toString(),
              quantity: 30,
            },
          ],
          taxRate: 5,
          totalDiscount: 0,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
      expect(res.body.data.items.length).toBe(2); // Split across 2 batches

      // 1st allocation: Batch Early (25 units)
      expect(res.body.data.items[0].batchNumber).toBe('POS-BATCH-EARLY-25');
      expect(res.body.data.items[0].quantity).toBe(25);
      expect(res.body.data.items[0].purchasePriceSnapshot).toBe(10.0);

      // 2nd allocation: Batch Late (5 units)
      expect(res.body.data.items[1].batchNumber).toBe('POS-BATCH-LATE-50');
      expect(res.body.data.items[1].quantity).toBe(5);
      expect(res.body.data.items[1].purchasePriceSnapshot).toBe(11.0);

      expect(res.body.data.subtotal).toBe(750.0);
      expect(res.body.data.taxAmount).toBe(37.5);
      expect(res.body.data.grandTotal).toBe(787.5);

      createdSaleId = res.body.data._id;

      // Verify Batch stock balances in database
      const [earlyAfter, lateAfter] = await Promise.all([
        Batch.findById(batchEarly._id),
        Batch.findById(batchLate._id),
      ]);

      expect(earlyAfter?.availableQuantity).toBe(0);
      expect(lateAfter?.availableQuantity).toBe(45);

      // Verify Stock Movements recorded
      const movements = await StockMovement.find({
        relatedTransactionId: res.body.data.invoiceNumber,
      });
      expect(movements.length).toBe(2);
      expect(movements[0].movementType).toBe(MovementType.SALE);
      expect(movements[0].quantityRemoved).toBe(25);
      expect(movements[1].quantityRemoved).toBe(5);
    });

    it('should reject sale when requested quantity exceeds available non-expired stock', async () => {
      // Current available: BatchEarly = 0, BatchLate = 45. Total = 45 units.
      // BatchExpired has 20 units, but MUST be excluded.
      // If customer asks for 50 units, sale must be rejected with 400 Insufficient Stock!
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [
            {
              medicineId: testMedicine._id.toString(),
              quantity: 50,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient');
    });

    it('should prevent duplicate sale submission with same idempotencyKey', async () => {
      const idempotencyKey = 'unique-checkout-uuid-12345';

      // First submission
      const res1 = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          idempotencyKey,
          items: [{ medicineId: testMedicine._id.toString(), quantity: 5 }],
        });

      expect(res1.status).toBe(201);
      const invoiceNumber1 = res1.body.data.invoiceNumber;

      // Duplicate submission with same key
      const res2 = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          idempotencyKey,
          items: [{ medicineId: testMedicine._id.toString(), quantity: 5 }],
        });

      // Must return identical cached transaction without double deduction!
      expect(res2.status).toBe(201);
      expect(res2.body.data.invoiceNumber).toBe(invoiceNumber1);
    });

    it('should deny Customers from creating sales transactions', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ medicineId: testMedicine._id.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(403);
    });

    it('should return print-ready formatted invoice details', async () => {
      const res = await request(app)
        .get(`/api/sales/${createdSaleId}/invoice`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pharmacyHeader');
      expect(res.body.data.pharmacyHeader).toHaveProperty('storeName');
      expect(res.body.data).toHaveProperty('invoiceMeta');
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary.grandTotal).toBe(787.5);
      expect(res.body.data).toHaveProperty('legalFooter');
    });

    it('should list sales with revenue and discount summary aggregates', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary.totalRevenue).toBeGreaterThan(0);
    });
  });
});
