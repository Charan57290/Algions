import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User, UserRole } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Supplier, SupplierStatus } from '../models/Supplier.js';
import { Medicine, DosageForm, UnitOfMeasurement } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { generateToken } from '../utils/jwt.js';

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_masterdata_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 4: Master Data Management API Suite', () => {
  let adminToken: string;
  let pharmacistToken: string;
  let customerToken: string;

  let createdCategory: any;
  let createdSupplier: any;
  let createdMedicine: any;

  beforeAll(async () => {
    // Create users for auth tokens
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@masterdata.test',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
    });

    const pharmacist = await User.create({
      name: 'Pharmacist User',
      email: 'pharmacist@masterdata.test',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
    });

    const customer = await User.create({
      name: 'Customer User',
      email: 'customer@masterdata.test',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
    });

    adminToken = generateToken({ userId: admin._id.toString(), email: admin.email, role: admin.role });
    pharmacistToken = generateToken({ userId: pharmacist._id.toString(), email: pharmacist.email, role: pharmacist.role });
    customerToken = generateToken({ userId: customer._id.toString(), email: customer.email, role: customer.role });
  });

  // ==========================================
  // Category API Suite
  // ==========================================
  describe('Category Endpoints (/api/categories)', () => {
    it('should allow ADMIN to create a category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Antibiotics Test Category',
          description: 'Anti-bacterial drugs',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Antibiotics Test Category');
      expect(res.body.data.slug).toBe('antibiotics-test-category');

      createdCategory = res.body.data;
    });

    it('should reject duplicate category name', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Antibiotics Test Category',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should deny non-admin (Pharmacist) from creating a category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          name: 'Unauthorized Category',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return all categories with aggregated medicine counts', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('medicineCount');
    });

    it('should allow ADMIN to update category', async () => {
      const res = await request(app)
        .put(`/api/categories/${createdCategory._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description for antibiotics',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated description for antibiotics');
    });
  });

  // ==========================================
  // Supplier API Suite
  // ==========================================
  describe('Supplier Endpoints (/api/suppliers)', () => {
    it('should allow ADMIN to register a new supplier', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierCode: 'SUP-TEST-01',
          name: 'Apex Test Pharma Dist',
          contactPerson: 'Vikas Gupta',
          phone: '+91 98888 77777',
          email: 'orders@apextest.com',
          status: SupplierStatus.ACTIVE,
          address: {
            city: 'Hyderabad',
            state: 'Telangana',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.supplierCode).toBe('SUP-TEST-01');

      createdSupplier = res.body.data;
    });

    it('should reject duplicate supplier code', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierCode: 'SUP-TEST-01',
          name: 'Different Supplier Name',
          contactPerson: 'Person',
          phone: '+91 90000 00000',
          email: 'different@test.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should allow Pharmacist to view suppliers list with search filter', async () => {
      const res = await request(app)
        .get('/api/suppliers?search=Apex')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toContain('Apex');
      expect(res.body.data[0]).toHaveProperty('totalBatchesSupplied');
    });

    it('should deny Pharmacist from updating supplier', async () => {
      const res = await request(app)
        .put(`/api/suppliers/${createdSupplier._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });

    it('should allow Admin to update supplier details', async () => {
      const res = await request(app)
        .put(`/api/suppliers/${createdSupplier._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contactPerson: 'Suresh Kumar' });

      expect(res.status).toBe(200);
      expect(res.body.data.contactPerson).toBe('Suresh Kumar');
    });
  });

  // ==========================================
  // Medicine API Suite
  // ==========================================
  describe('Medicine Endpoints (/api/medicines)', () => {
    it('should allow ADMIN to create a medicine SKU', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineCode: 'MED-AMOX-TEST',
          name: 'Amoxicillin 500mg Capsules',
          genericName: 'Amoxicillin Trihydrate',
          brandName: 'Amoxil Test',
          category: createdCategory._id,
          manufacturer: 'Apex Pharma',
          dosageForm: DosageForm.CAPSULE,
          strength: '500 mg',
          sku: 'SKU-AMOX-TEST',
          barcode: '890123499999',
          unitOfMeasurement: UnitOfMeasurement.STRIP,
          reorderThreshold: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe('SKU-AMOX-TEST');

      createdMedicine = res.body.data;
    });

    it('should reject duplicate SKU and duplicate Barcode', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineCode: 'MED-DIFFERENT',
          name: 'Duplicate SKU Med',
          genericName: 'Chemical',
          brandName: 'Brand',
          category: createdCategory._id,
          manufacturer: 'Pharma',
          dosageForm: DosageForm.TABLET,
          strength: '10mg',
          sku: 'SKU-AMOX-TEST', // Duplicate
          unitOfMeasurement: UnitOfMeasurement.STRIP,
          reorderThreshold: 10,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('SKU');
    });

    it('should deny Pharmacist from creating a medicine', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          medicineCode: 'MED-HACK',
          name: 'Hacked Med',
          genericName: 'Generic',
          brandName: 'Brand',
          category: createdCategory._id,
          manufacturer: 'Pharma',
          dosageForm: DosageForm.TABLET,
          strength: '10mg',
          sku: 'SKU-HACK',
          unitOfMeasurement: UnitOfMeasurement.STRIP,
        });

      expect(res.status).toBe(403);
    });

    it('should allow Pharmacist and Customer to search medicines', async () => {
      const res = await request(app)
        .get('/api/medicines?search=Amoxicillin')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toContain('Amoxicillin');
      expect(res.body.data[0]).toHaveProperty('totalAvailableStock');
      expect(res.body.data[0]).toHaveProperty('isLowStock');
    });

    it('should filter medicines by category', async () => {
      const res = await request(app)
        .get(`/api/medicines?category=${createdCategory._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category._id).toBe(createdCategory._id);
    });

    it('should get detailed medicine view with batch breakdown', async () => {
      // Add an active batch and an expired batch to verify real-time stock computation
      const futureExpiry = new Date();
      futureExpiry.setMonth(futureExpiry.getMonth() + 6);

      const pastExpiry = new Date();
      pastExpiry.setMonth(pastExpiry.getMonth() - 1);

      await Batch.create([
        {
          medicine: createdMedicine._id,
          batchNumber: 'BATCH-ACT-01',
          supplier: createdSupplier._id,
          manufacturingDate: new Date('2025-01-01'),
          expiryDate: futureExpiry,
          purchasePrice: 40,
          sellingPrice: 80,
          initialQuantity: 50,
          availableQuantity: 35,
        },
        {
          medicine: createdMedicine._id,
          batchNumber: 'BATCH-EXP-01',
          supplier: createdSupplier._id,
          manufacturingDate: new Date('2024-01-01'),
          expiryDate: pastExpiry, // Expired
          purchasePrice: 35,
          sellingPrice: 75,
          initialQuantity: 20,
          availableQuantity: 20,
        },
      ]);

      const res = await request(app)
        .get(`/api/medicines/${createdMedicine._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalAvailableStock).toBe(35); // Only active non-expired stock
      expect(res.body.data.expiredStock).toBe(20); // Expired stock isolated
      expect(res.body.data.isLowStock).toBe(false); // 35 > reorderThreshold of 20
      expect(res.body.data.batches.length).toBe(2);
    });

    it('should trigger low-stock alert when available stock is below reorder threshold', async () => {
      // Create another medicine with 0 batches (available stock 0 <= threshold 15)
      const lowStockMed = await Medicine.create({
        medicineCode: 'MED-LOW-TEST',
        name: 'Low Stock Test Drug',
        genericName: 'Low Drug',
        brandName: 'Low Brand',
        category: createdCategory._id,
        manufacturer: 'Apex Pharma',
        dosageForm: DosageForm.TABLET,
        strength: '100 mg',
        sku: 'SKU-LOW-TEST',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 15,
      });

      const res = await request(app)
        .get('/api/medicines/alerts/low-stock')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((m: any) => m._id === lowStockMed._id.toString())).toBe(true);
    });

    it('should safely deactivate medicine if it has batch records on delete request', async () => {
      const res = await request(app)
        .delete(`/api/medicines/${createdMedicine._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deactivated');

      // Verify isActive is now false
      const checkMed = await Medicine.findById(createdMedicine._id);
      expect(checkMed?.isActive).toBe(false);
    });

    it('should block deletion of category when medicines are associated with it', async () => {
      const res = await request(app)
        .delete(`/api/categories/${createdCategory._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('associated with it');
    });
  });
});
