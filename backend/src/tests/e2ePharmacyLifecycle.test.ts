import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import {
  User,
  Category,
  Supplier,
  Medicine,
  Batch,
  StockMovement,
  Purchase,
  Sale,
  Return,
  StockAdjustment,
} from '../models';
import { seedDatabase } from '../database/seed';

const MONGODB_TEST_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_management_e2e';

describe('Phase 10: End-to-End Pharmacy Lifecycle & Security Verification', () => {
  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;
  let testSupplierId: string;
  let testMedicineId: string;
  let createdBatchId: string;
  let createdBatchNumber: string;
  let completedSaleId: string;
  let invoiceNumber: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_TEST_URI);
    }
    // Clean and seed fresh database
    await mongoose.connection.dropDatabase();
    await seedDatabase(false);

    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pharmacy.com', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // Authenticate Pharmacist
    const pharmRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pharmacist@pharmacy.com', password: 'Pharmacist@123' });
    expect(pharmRes.status).toBe(200);
    pharmacistToken = pharmRes.body.data.token;

    // Authenticate Customer
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@pharmacy.com', password: 'Customer@123' });
    expect(custRes.status).toBe(200);
    customerToken = custRes.body.data.token;
  }, 25000);

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe('Step 1: Master Data & Stock Inward Consignment (Goods Receiving)', () => {
    it('should find active suppliers and medicines from seed', async () => {
      const suppRes = await request(app)
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(suppRes.status).toBe(200);
      expect(suppRes.body.data.length).toBeGreaterThan(0);
      testSupplierId = suppRes.body.data[0]._id;

      const medRes = await request(app)
        .get('/api/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`);
      expect(medRes.status).toBe(200);
      expect(medRes.body.data.medicines.length).toBeGreaterThan(0);
      testMedicineId = medRes.body.data.medicines[0]._id;
    });

    it('should receive a fresh purchase order consignment and create a discrete batch', async () => {
      createdBatchNumber = `E2E-LOT-${Date.now().toString().slice(-5)}`;
      const mfgDate = new Date();
      const expDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days out

      const inwardPayload = {
        supplier: testSupplierId,
        supplierInvoiceNumber: `INV-E2E-SUPP-${Date.now().toString().slice(-4)}`,
        items: [
          {
            medicine: testMedicineId,
            batchNumber: createdBatchNumber,
            manufacturingDate: mfgDate.toISOString(),
            expiryDate: expDate.toISOString(),
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
      expect(res.body.data.purchaseOrderNumber).toMatch(/^PO-\d{6}-\d{4}$/);

      // Verify batch existence in DB
      const batchDoc = await Batch.findOne({ batchNumber: createdBatchNumber });
      expect(batchDoc).not.toBeNull();
      expect(batchDoc?.availableQuantity).toBe(50);
      expect(batchDoc?.initialQuantity).toBe(50);
      createdBatchId = batchDoc!._id.toString();

      // Verify stock movement ledger record
      const movement = await StockMovement.findOne({
        batch: createdBatchId,
        movementType: 'PURCHASE_RECEIPT',
      });
      expect(movement).not.toBeNull();
      expect(movement?.quantityAdded).toBe(50);
      expect(movement?.newBalance).toBe(50);
    });
  });

  describe('Step 2: FEFO Allocation Preview & POS Billing Checkout', () => {
    it('should preview FEFO allocation prior to checkout', async () => {
      const previewRes = await request(app)
        .post('/api/sales/preview-fefo')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [{ medicineId: testMedicineId, quantity: 15 }],
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      const preview = previewRes.body.data[0];
      expect(preview.isFullyAllocated).toBe(true);
      expect(preview.allocatedQuantity).toBe(15);
      expect(preview.allocations.length).toBeGreaterThan(0);
    });

    it('should complete sale, deduct batch stock via FEFO, and generate invoice', async () => {
      const salePayload = {
        items: [{ medicineId: testMedicineId, quantity: 10 }],
        customerName: 'Ananya Sharma',
        customerPhone: '9876543210',
        doctorName: 'Dr. S. K. Gupta',
        paymentMethod: 'UPI',
        discountAmount: 10,
        notes: 'Regular customer prescription dispensing.',
      };

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(salePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.totalAmount).toBeGreaterThan(0);

      completedSaleId = res.body.data._id;
      invoiceNumber = res.body.data.invoiceNumber;

      // Verify stock movement of SALE_DISPENSE was recorded
      const saleMovement = await StockMovement.findOne({
        referenceId: completedSaleId,
        movementType: 'SALE_DISPENSE',
      });
      expect(saleMovement).not.toBeNull();
      expect(saleMovement?.quantityRemoved).toBeGreaterThan(0);
    });

    it('should generate printable tax invoice payload', async () => {
      const invRes = await request(app)
        .get(`/api/sales/${completedSaleId}/invoice`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(invRes.status).toBe(200);
      expect(invRes.body.success).toBe(true);
      const invoiceData = invRes.body.data;
      expect(invoiceData.pharmacyDetails.name).toBe('Algions Pharmacy');
      expect(invoiceData.invoice.invoiceNumber).toBe(invoiceNumber);
      expect(invoiceData.invoice.customerName).toBe('Ananya Sharma');
      expect(invoiceData.items.length).toBeGreaterThan(0);
      expect(invoiceData.financialSummary.netPayable).toBeGreaterThan(0);
    });
  });

  describe('Step 3: Customer Return & Restock Safety Evaluation', () => {
    it('should process customer return, restore undamaged goods to batch, and update invoice status', async () => {
      // Find the batch that was sold in the transaction
      const sale = await Sale.findById(completedSaleId);
      expect(sale).not.toBeNull();
      const soldItem = sale!.items[0];
      const soldBatchId = soldItem.batch.toString();

      const batchBeforeReturn = await Batch.findById(soldBatchId);
      const balanceBeforeReturn = batchBeforeReturn!.availableQuantity;

      const returnPayload = {
        saleId: completedSaleId,
        reason: 'Patient prescribed revised dosage by consulting physician.',
        items: [
          {
            batchId: soldBatchId,
            quantity: 2,
            restock: true,
            condition: 'UNDAMAGED',
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

      // Verify batch stock was restored by exactly 2 units
      const batchAfterReturn = await Batch.findById(soldBatchId);
      expect(batchAfterReturn!.availableQuantity).toBe(balanceBeforeReturn + 2);

      // Verify sale status transition to PARTIALLY_REFUNDED
      const updatedSale = await Sale.findById(completedSaleId);
      expect(updatedSale!.status).toBe('PARTIALLY_REFUNDED');
    });

    it('should reject over-return exceeding purchased quantity', async () => {
      const sale = await Sale.findById(completedSaleId);
      const soldItem = sale!.items[0];
      const soldBatchId = soldItem.batch.toString();

      const overReturnPayload = {
        saleId: completedSaleId,
        reason: 'Attempting invalid excess return.',
        items: [
          {
            batchId: soldBatchId,
            quantity: 100, // Exceeds 10 sold
            restock: false,
            condition: 'DAMAGED',
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
      const batch = await Batch.findById(createdBatchId);
      const prevQty = batch!.availableQuantity;

      const adjPayload = {
        batchId: createdBatchId,
        adjustmentType: 'DECREASE',
        quantity: 5,
        reasonCode: 'DAMAGE',
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
        movementType: 'ADJUSTMENT_DAMAGE',
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
          adjustmentType: 'DECREASE',
          quantity: excessiveQty,
          reasonCode: 'COUNT_CORRECTION',
          remarks: 'Excessive subtraction test.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient stock');
    });
  });

  describe('Step 5: Analytical Reports & Stock Reconciliation Concordance', () => {
    it('should generate operational dashboard metrics with non-zero financial and inventory data', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const kpis = res.body.data;
      expect(kpis.inventory.totalBatches).toBeGreaterThan(0);
      expect(kpis.valuation.totalRetailValuation).toBeGreaterThan(0);
      expect(kpis.salesPerformance.salesCount).toBeGreaterThan(0);
      expect(kpis.sevenDayTrend).toBeInstanceOf(Array);
    });

    it('should verify mathematical double-entry stock reconciliation', async () => {
      const res = await request(app)
        .get('/api/reports/reconciliation')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalActiveBatchesAudited).toBeGreaterThan(0);
      // Double entry ledger should have zero mathematical discrepancies
      expect(res.body.data.summary.discrepancyCount).toBe(0);
      expect(res.body.data.summary.auditPassed).toBe(true);
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
