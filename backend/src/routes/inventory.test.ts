import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User, UserRole } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Supplier, SupplierStatus } from '../models/Supplier.js';
import { Medicine, DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { generateToken } from '../utils/jwt.js';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_inventory_routes_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 5: Inventory, Batches, Purchases & Stock Movement Routes', () => {
  let adminToken: string;
  let pharmacistToken: string;

  let testCategory: any;
  let testSupplier: any;
  let testMedicine: any;

  beforeAll(async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@invroutes.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });

    const pharmacist = await User.create({
      name: 'Pharmacist User',
      email: 'pharmacist@invroutes.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });

    adminToken = generateToken({ userId: admin._id.toString(), email: admin.email, role: admin.role });
    pharmacistToken = generateToken({ userId: pharmacist._id.toString(), email: pharmacist.email, role: pharmacist.role });

    testCategory = await Category.create({
      name: 'Cardiology Inventory Test',
      slug: 'cardiology-inventory-test',
    });

    testSupplier = await Supplier.create({
      supplierCode: 'SUP-INV-001',
      name: 'National Pharma Logistics',
      contactPerson: 'Karan Mehra',
      phone: '+91 94444 33333',
      email: 'orders@natpharma.test',
      status: SupplierStatus.ACTIVE,
    });

    testMedicine = await Medicine.create({
      medicineCode: 'MED-ATOR-INV',
      name: 'Atorvastatin 20mg Tablets',
      genericName: 'Atorvastatin',
      brandName: 'Lipitor Test',
      category: testCategory._id,
      manufacturer: 'National Pharma Labs',
      dosageForm: DosageForm.TABLET,
      strength: '20 mg',
      sku: 'SKU-ATOR-INV',
      unitOfMeasurement: UnitOfMeasurement.STRIP,
      reorderThreshold: 25,
    });
  });

  describe('POST /api/purchases (Stock Receiving Workflow)', () => {
    it('should receive supplier consignment, create batches, increment inventory, and record stock movements', async () => {
      const now = new Date();
      const mfgDate = new Date(now);
      mfgDate.setMonth(now.getMonth() - 2);

      const expDate = new Date(now);
      expDate.setMonth(now.getMonth() + 18);

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          supplierId: testSupplier._id.toString(),
          supplierInvoiceNumber: 'INV-SUP-998877',
          items: [
            {
              medicineId: testMedicine._id.toString(),
              batchNumber: 'BATCH-ATOR-P1',
              manufacturingDate: mfgDate.toISOString().slice(0, 10),
              expiryDate: expDate.toISOString().slice(0, 10),
              quantity: 100,
              purchasePrice: 45.0,
              sellingPrice: 90.0,
            },
          ],
          taxAmount: 225.0,
          notes: 'Standard monthly replenishment order',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchaseNumber).toMatch(/^PO-\d{8}-\d{4}$/);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(100);
      expect(res.body.data.totalAmount).toBe(4725.0); // (100 * 45) + 225 tax
    });

    it('should list purchases with pagination and supplier details', async () => {
      const res = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('supplier');
      expect(res.body.data[0]).toHaveProperty('receivedBy');
    });
  });

  describe('GET /api/batches/fefo-preview', () => {
    it('should return FEFO preview without modifying database state', async () => {
      const res = await request(app)
        .get(`/api/batches/fefo-preview?medicine=${testMedicine._id}&quantity=20`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSufficient).toBe(true);
      expect(res.body.data.totalAllocated).toBe(20);
      expect(res.body.data.allocations[0].batchNumber).toBe('BATCH-ATOR-P1');
      expect(res.body.data.allocations[0].allocatedQuantity).toBe(20);
    });
  });

  describe('GET /api/batches/valuation', () => {
    it('should return inventory valuation report with reconciled cost, retail, and margin metrics', async () => {
      const res = await request(app)
        .get('/api/batches/valuation')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('activeInventory');
      expect(res.body.data).toHaveProperty('expiredInventory');

      const { activeInventory } = res.body.data;
      expect(activeInventory.totalCostValue).toBe(4500.0); // 100 * 45
      expect(activeInventory.totalRetailValue).toBe(9000.0); // 100 * 90
      expect(activeInventory.expectedGrossProfit).toBe(4500.0);
      expect(activeInventory.grossMarginPercent).toBe(50.0);
    });
  });

  describe('GET /api/batches/alerts/near-expiry', () => {
    it('should return near-expiry alert batches when batches approach expiration threshold', async () => {
      // Create a batch expiring in 15 days
      const nearExp = new Date();
      nearExp.setDate(nearExp.getDate() + 15);

      await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicine: testMedicine._id.toString(),
          batchNumber: 'BATCH-NEAR-EXP-01',
          supplier: testSupplier._id.toString(),
          manufacturingDate: new Date('2025-01-01').toISOString().slice(0, 10),
          expiryDate: nearExp.toISOString().slice(0, 10),
          purchasePrice: 40,
          sellingPrice: 85,
          initialQuantity: 30,
        });

      const res = await request(app)
        .get('/api/batches/alerts/near-expiry?days=30')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((b: any) => b.batchNumber === 'BATCH-NEAR-EXP-01')).toBe(true);
      const targetBatch = res.body.data.find((b: any) => b.batchNumber === 'BATCH-NEAR-EXP-01');
      expect(targetBatch).toHaveProperty('daysUntilExpiry');
      expect(targetBatch).toHaveProperty('urgencyLevel');
    });
  });

  describe('GET /api/movements (Stock Movement Ledger Audit Trail)', () => {
    it('should return immutable audit ledger of all inventory inflows and outflows', async () => {
      const res = await request(app)
        .get('/api/movements')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const purchaseMovement = res.body.data.find(
        (m: any) => m.movementType === 'PURCHASE_RECEIVED'
      );
      expect(purchaseMovement).toBeDefined();
      expect(purchaseMovement.quantityAdded).toBe(100);
      expect(purchaseMovement.newBalance).toBe(100);
      expect(purchaseMovement).toHaveProperty('user');
    });
  });
});
