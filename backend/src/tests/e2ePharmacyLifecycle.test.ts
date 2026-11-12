import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
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
  Sale,
  AdjustmentType,
  AdjustmentReason,
} from '../models/index.js';
import { generateToken } from '../utils/jwt.js';

const MONGODB_TEST_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_management_e2e';

const app = createApp();

describe('Phase 10: End-to-End Pharmacy Lifecycle & Security Verification', () => {
  let adminUser: any;
  let pharmacistUser: any;
  let customerUser: any;

  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;

  let testCategory: any;
  let testSupplier: any;
  let testMedicine: any;

  let createdBatchId: string;
  let createdBatchNumber: string;
  let completedSaleId: string;
  let invoiceNumber: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_TEST_URI);
    }
    await mongoose.connection.dropDatabase();
    await Promise.all([
      User.init(),
      Category.init(),
      Supplier.init(),
      Medicine.init(),
      Batch.init(),
      StockMovement.init(),
    ]);

    // 1. Create Core Users
    adminUser = await User.create({
      name: 'Dr. Alok Verma (Admin)',
      email: 'admin@e2e.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });
    adminToken = generateToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    pharmacistUser = await User.create({
      name: 'Sarah Jenkins (Pharmacist)',
      email: 'pharmacist@e2e.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });
    pharmacistToken = generateToken({
      userId: pharmacistUser._id.toString(),
      email: pharmacistUser.email,
      role: pharmacistUser.role,
    });

    customerUser = await User.create({
      name: 'Rahul Sharma (Customer)',
      email: 'customer@e2e.test',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
    });
    customerToken = generateToken({
      userId: customerUser._id.toString(),
      email: customerUser.email,
      role: customerUser.role,
    });

    // 2. Create Master Category & Supplier
    testCategory = await Category.create({
      name: 'Antibiotics & Antimicrobials',
      slug: 'antibiotics-antimicrobials-e2e',
      description: 'Prescription antibiotics',
    });

    testSupplier = await Supplier.create({
      name: 'Apex Pharma Distribution',
      supplierCode: 'SUPP-APEX-01',
      contactPerson: 'Vikram Sharma',
      email: 'orders@apexpharma.test',
      phone: '+91 98765 11111',
      gstin: '27AABCU9603R1ZM',
      status: SupplierStatus.ACTIVE,
    });

    // 3. Create Master Medicine
    testMedicine = await Medicine.create({
      medicineCode: 'MED-AMOX-500',
      name: 'Amoxicillin 500mg Capsules',
      genericName: 'Amoxicillin Trihydrate',
      brandName: 'Amoxil',
      category: testCategory._id,
      manufacturer: 'GlaxoSmithKline',
      dosageForm: DosageForm.CAPSULE,
      strength: '500mg',
      sku: 'MED-AMOX-500-E2E',
      barcode: '8901234999999',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 20,
      requiresPrescription: true,
      isActive: true,
    });
  }, 30000);

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('Step 1: Stock Inward Consignment (Goods Receiving & Batch Creation)', () => {
    it('should receive a fresh purchase order consignment and create a discrete batch', async () => {
      createdBatchNumber = `E2E-LOT-${Date.now().toString().slice(-5)}`;
      const mfgDate = new Date();
      const expDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days out

      const inwardPayload = {
        supplierId: testSupplier._id.toString(),
        supplierInvoiceNumber: `INV-E2E-SUPP-${Date.now().toString().slice(-4)}`,
        items: [
          {
            medicineId: testMedicine._id.toString(),
            batchNumber: createdBatchNumber,
            manufacturingDate: mfgDate.toISOString().split('T')[0],
            expiryDate: expDate.toISOString().split('T')[0],
            purchasePrice: 20.0,
            sellingPrice: 35.0,
            quantity: 50,
          },
        ],
        notes: 'Cold-chain shipment verified intact.',
      };

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(inwardPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchaseNumber).toMatch(/^PO-\d{8}-\d{4}$/);

      // Verify batch existence in DB
      const batchDoc = await Batch.findOne({ batchNumber: createdBatchNumber });
      expect(batchDoc).not.toBeNull();
      expect(batchDoc?.availableQuantity).toBe(50);
      expect(batchDoc?.initialQuantity).toBe(50);
      createdBatchId = batchDoc!._id.toString();

      // Verify stock movement ledger record
      const movement = await StockMovement.findOne({
        batch: createdBatchId,
        movementType: MovementType.PURCHASE_RECEIVED,
      });
      expect(movement).not.toBeNull();
      expect(movement?.quantityAdded).toBe(50);
      expect(movement?.newBalance).toBe(50);
    });
  });

  describe('Step 2: FEFO Allocation Preview & POS Billing Checkout', () => {
    it('should preview FEFO allocation prior to checkout', async () => {
      const previewRes = await request(app)
        .get(`/api/batches/fefo-preview?medicine=${testMedicine._id.toString()}&quantity=15`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      const preview = previewRes.body.data;
      expect(preview.requestedQuantity).toBe(15);
      expect(preview.allocations.length).toBeGreaterThan(0);
      expect(preview.isSufficient).toBe(true);
    });

    it('should complete sale, deduct batch stock via FEFO, and generate invoice', async () => {
      const salePayload = {
        customer: {
          name: 'Ananya Sharma',
          phone: '9876543210',
        },
        items: [{ medicineId: testMedicine._id.toString(), quantity: 10 }],
        paymentMethod: 'UPI',
        totalDiscount: 10,
        notes: 'Regular customer prescription dispensing.',
      };

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(salePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
      expect(res.body.data.grandTotal).toBeGreaterThan(0);

      completedSaleId = res.body.data._id;
      invoiceNumber = res.body.data.invoiceNumber;

      // Verify batch stock was deducted by exactly 10
      const batchAfterSale = await Batch.findById(createdBatchId);
      expect(batchAfterSale?.availableQuantity).toBe(40);

      // Verify stock movement of SALE was recorded
      const saleMovement = await StockMovement.findOne({
        relatedTransactionId: invoiceNumber,
        movementType: MovementType.SALE,
      });
      expect(saleMovement).not.toBeNull();
      expect(saleMovement?.quantityRemoved).toBe(10);
      expect(saleMovement?.newBalance).toBe(40);
    });

    it('should generate printable tax invoice payload', async () => {
      const invRes = await request(app)
        .get(`/api/sales/${completedSaleId}/invoice`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(invRes.status).toBe(200);
      expect(invRes.body.success).toBe(true);
      const invoiceData = invRes.body.data;
      expect(invoiceData.pharmacyHeader.storeName).toBe('PharmaCare Pharmacy & Medical Store');
      expect(invoiceData.invoiceMeta.invoiceNumber).toBe(invoiceNumber);
      expect(invoiceData.customer.name).toBe('Ananya Sharma');
      expect(invoiceData.items.length).toBeGreaterThan(0);
      expect(invoiceData.summary.grandTotal).toBeGreaterThan(0);
    });
  });

  describe('Step 3: Customer Return & Restock Safety Evaluation', () => {
    it('should process customer return, restore undamaged goods to batch, and update invoice status', async () => {
      const returnPayload = {
        saleId: completedSaleId,
        overallReason: 'Patient prescribed revised dosage by consulting physician.',
        items: [
          {
            medicineId: testMedicine._id.toString(),
            batchId: createdBatchId,
            quantityReturned: 2,
            reason: 'Revised dosage',
            restockable: true,
          },
        ],
      };

      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(returnPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.returnNumber).toMatch(/^RET-\d{6}-\d{4}$/);
      expect(res.body.data.totalRefundAmount).toBeGreaterThan(0);

      // Verify batch stock was restored from 40 to 42
      const batchAfterReturn = await Batch.findById(createdBatchId);
      expect(batchAfterReturn!.availableQuantity).toBe(42);

      // Verify sale status transition to PARTIALLY_REFUNDED
      const updatedSale = await Sale.findById(completedSaleId);
      expect(updatedSale!.status).toBe('PARTIALLY_REFUNDED');
    });

    it('should reject over-return exceeding purchased quantity', async () => {
      const overReturnPayload = {
        saleId: completedSaleId,
        overallReason: 'Attempting invalid excess return.',
        items: [
          {
            medicineId: testMedicine._id.toString(),
            batchId: createdBatchId,
            quantityReturned: 100, // Exceeds 10 sold
            reason: 'Excess return',
            restockable: false,
          },
        ],
      };

      const res = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(overReturnPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Step 4: Audited Stock Adjustment & Non-Negative Inventory Guard', () => {
    it('should record audited stock decrease with mandatory reason code', async () => {
      const batchBeforeAdj = await Batch.findById(createdBatchId);
      const prevQty = batchBeforeAdj!.availableQuantity;

      const adjPayload = {
        batchId: createdBatchId,
        adjustmentType: AdjustmentType.DECREASE,
        adjustedQuantity: 5,
        reason: AdjustmentReason.DAMAGED_GOODS,
        remarks: 'Ampoule broken during routine shelving by night shift.',
      };

      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(adjPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adjustmentNumber).toMatch(/^ADJ-\d{6}-\d{4}$/);
      expect(res.body.data.newQuantity).toBe(prevQty - 5);

      // Verify stock movement ledger record
      const adjMovement = await StockMovement.findOne({
        batch: createdBatchId,
        movementType: MovementType.STOCK_ADJUSTMENT,
      });
      expect(adjMovement).not.toBeNull();
      expect(adjMovement?.quantityRemoved).toBe(5);
    });

    it('should strictly reject stock decrease exceeding current batch quantity', async () => {
      const batch = await Batch.findById(createdBatchId);
      const excessiveQty = batch!.availableQuantity + 100;

      const res = await request(app)
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          batchId: createdBatchId,
          adjustmentType: AdjustmentType.DECREASE,
          adjustedQuantity: excessiveQty,
          reason: AdjustmentReason.STOCKTAKE_CORRECTION,
          remarks: 'Excessive subtraction test remarks.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Negative stock');
    });
  });

  describe('Step 5: Analytical Reports & Stock Reconciliation Concordance', () => {
    it('should generate operational dashboard metrics with non-zero financial and inventory data', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.kpis.totalMedicines).toBeGreaterThan(0);
      expect(data.kpis.totalAvailableUnits).toBeGreaterThan(0);
      expect(data.recentSales).toBeInstanceOf(Array);
      expect(data.salesTrend).toBeInstanceOf(Array);
    });

    it('should verify mathematical double-entry stock reconciliation', async () => {
      const res = await request(app)
        .get('/api/reports/reconciliation')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBatchesAudited).toBeGreaterThan(0);
      // Double entry ledger should have zero mathematical discrepancies
      expect(res.body.data.totalDiscrepancies).toBe(0);
      expect(res.body.data.reconciliationStatus).toBe('PERFECTLY_RECONCILED');
    });
  });

  describe('Step 6: Role-Based Authorization & Security Perimeter Verification', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const res = await request(app).get('/api/reports/dashboard');
      expect(res.status).toBe(401);
    });

    it('should forbid Customer role from accessing administrative supplier APIs', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Supplier Attempt',
          contactPerson: 'Attacker',
          phone: '9999999999',
          email: 'test@unauth.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should forbid Pharmacist role from administrative user management APIs', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow Admin full access to user management APIs', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
