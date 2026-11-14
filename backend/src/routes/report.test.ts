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
import { generateToken } from '../utils/jwt.js';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_reports_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 8: Inventory Alerts & Analytical Reporting Suite', () => {
  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;

  let testCategory: any;
  let testSupplier: any;
  let testMedicine: any;
  let testBatch: any;

  beforeAll(async () => {
    const admin = await User.create({
      name: 'Admin Manager',
      email: 'manager@reports.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });

    const pharmacist = await User.create({
      name: 'Pharmacist Analyst',
      email: 'analyst@reports.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });

    const customer = await User.create({
      name: 'Customer Dave',
      email: 'customer@reports.test',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
    });

    adminToken = generateToken({ userId: admin._id.toString(), email: admin.email, role: admin.role });
    pharmacistToken = generateToken({ userId: pharmacist._id.toString(), email: pharmacist.email, role: pharmacist.role });
    customerToken = generateToken({ userId: customer._id.toString(), email: customer.email, role: customer.role });

    testCategory = await Category.create({
      name: 'Analytics Test Category',
      slug: 'analytics-test-category',
    });

    testSupplier = await Supplier.create({
      supplierCode: 'SUP-REP-01',
      name: 'Report Test Supplier',
      contactPerson: 'Manager',
      phone: '+91 97777 66666',
      email: 'orders@repsupplier.test',
      status: SupplierStatus.ACTIVE,
    });

    testMedicine = await Medicine.create({
      medicineCode: 'MED-REP-01',
      name: 'Azithromycin Reports 500mg',
      genericName: 'Azithromycin',
      brandName: 'Zithro Test',
      category: testCategory._id,
      manufacturer: 'Apex Pharma',
      dosageForm: DosageForm.TABLET,
      strength: '500 mg',
      sku: 'SKU-AZIT-REP',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 20,
    });

    const now = new Date();
    const expirySoon = new Date(now);
    expirySoon.setDate(now.getDate() + 5); // Critical: <= 7 days

    const expiryMonth = new Date(now);
    expiryMonth.setDate(now.getDate() + 25); // High: <= 30 days

    const expiryPast = new Date(now);
    expiryPast.setDate(now.getDate() - 5); // Expired

    // Create 3 batches: Critical, High, Expired
    testBatch = await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'REP-BATCH-CRIT',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-01-01'),
      expiryDate: expirySoon,
      purchasePrice: 20.0,
      sellingPrice: 50.0,
      initialQuantity: 50,
      availableQuantity: 40,
    });

    // Opening stock movement for reconciliation test
    await StockMovement.create({
      medicine: testMedicine._id,
      batch: testBatch._id,
      movementType: MovementType.OPENING_STOCK,
      quantityAdded: 50,
      quantityRemoved: 0,
      previousBalance: 0,
      newBalance: 50,
      reason: 'Opening stock',
      user: admin._id,
    });

    // Sale movement for reconciliation test
    await StockMovement.create({
      medicine: testMedicine._id,
      batch: testBatch._id,
      movementType: MovementType.SALE,
      quantityAdded: 0,
      quantityRemoved: 10,
      previousBalance: 50,
      newBalance: 40,
      reason: 'Sale deduction',
      user: admin._id,
    });

    await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'REP-BATCH-30D',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2025-01-01'),
      expiryDate: expiryMonth,
      purchasePrice: 25.0,
      sellingPrice: 55.0,
      initialQuantity: 30,
      availableQuantity: 30,
    });

    await Batch.create({
      medicine: testMedicine._id,
      batchNumber: 'REP-BATCH-EXP',
      supplier: testSupplier._id,
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: expiryPast,
      purchasePrice: 15.0,
      sellingPrice: 40.0,
      initialQuantity: 20,
      availableQuantity: 20,
    });

    // Create a sale for sales report metrics
    await Sale.create({
      invoiceNumber: 'INV-REP-0001',
      customer: { name: 'Customer Test', phone: '+91 99999 00000' },
      items: [
        {
          medicine: testMedicine._id,
          batch: testBatch._id,
          medicineName: testMedicine.name,
          batchNumber: testBatch.batchNumber,
          quantity: 10,
          unitPrice: 50.0,
          purchasePriceSnapshot: 20.0,
          discount: 0,
          taxRate: 5,
          taxAmount: 25.0,
          total: 525.0,
        },
      ],
      subtotal: 500.0,
      totalDiscount: 0,
      taxRate: 5,
      taxAmount: 25.0,
      grandTotal: 525.0,
      paymentMethod: 'UPI',
      status: SaleStatus.COMPLETED,
      cashier: pharmacist._id,
    });
  });

  describe('GET /api/reports/dashboard', () => {
    it('should return aggregated high-level KPIs and sales trend data', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('kpis');

      const { kpis } = res.body.data;
      expect(kpis.totalMedicines).toBeGreaterThanOrEqual(1);
      expect(kpis.totalSuppliers).toBeGreaterThanOrEqual(1);
      expect(kpis.todayRevenue).toBeGreaterThanOrEqual(525.0);
      expect(kpis.todayOrders).toBeGreaterThanOrEqual(1);

      expect(res.body.data).toHaveProperty('salesTrend');
      expect(res.body.data).toHaveProperty('recentSales');
      expect(res.body.data).toHaveProperty('recentPurchases');
    });

    it('should deny Customers from accessing dashboard KPIs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/reports/sales', () => {
    it('should return detailed sales metrics, cost of goods sold, gross margin, and top products', async () => {
      const res = await request(app)
        .get('/api/reports/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('metrics');

      const { metrics } = res.body.data;
      expect(metrics.transactionCount).toBeGreaterThanOrEqual(1);
      expect(metrics.grossRevenue).toBeGreaterThanOrEqual(500.0);
      expect(metrics.costOfGoodsSold).toBeGreaterThanOrEqual(200.0); // 10 units * 20 cost
      expect(metrics.grossProfit).toBeGreaterThanOrEqual(300.0); // 500 - 200
      expect(metrics.grossMarginPercent).toBe(60.0); // (300 / 500) * 100

      expect(res.body.data).toHaveProperty('paymentBreakdown');
      expect(res.body.data.paymentBreakdown).toHaveProperty('UPI');

      expect(res.body.data).toHaveProperty('topSellingMedicines');
      expect(res.body.data.topSellingMedicines.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/expiry', () => {
    it('should categorize batches into structured risk tiers (expired, critical, high, moderate, healthy)', async () => {
      const res = await request(app)
        .get('/api/reports/expiry')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('tiers');

      const { summary, tiers } = res.body.data;
      expect(summary.expiredCount).toBe(1);
      expect(tiers.expired[0].batchNumber).toBe('REP-BATCH-EXP');

      expect(summary.critical7DaysCount).toBe(1);
      expect(tiers.critical7Days[0].batchNumber).toBe('REP-BATCH-CRIT');

      expect(summary.high30DaysCount).toBe(1);
      expect(tiers.high30Days[0].batchNumber).toBe('REP-BATCH-30D');
    });
  });

  describe('GET /api/reports/reconciliation', () => {
    it('should mathematically verify stock movements against actual batch inventory with 0 variance', async () => {
      const res = await request(app)
        .get(`/api/reports/reconciliation?batchId=${testBatch._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reconciliationStatus).toBe('PERFECTLY_RECONCILED');
      expect(res.body.data.totalDiscrepancies).toBe(0);

      const targetBatch = res.body.data.batches[0];
      expect(targetBatch.currentActualStock).toBe(40);
      expect(targetBatch.ledgerCalculatedStock).toBe(40); // 50 opening - 10 sold = 40
      expect(targetBatch.variance).toBe(0);
      expect(targetBatch.isReconciled).toBe(true);
      expect(targetBatch.movementBreakdown.openingStock).toBe(50);
      expect(targetBatch.movementBreakdown.sold).toBe(10);
    });
  });
});
