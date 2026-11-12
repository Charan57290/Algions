import mongoose from 'mongoose';
import dotenv from 'dotenv';
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
  AuditLog,
  AuditAction,
  AuditEntity,
} from '../models/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_management';

export const seedDatabase = async (shouldClose = false) => {
  const isDirectRun = process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));
  const needsClose = shouldClose || isDirectRun;

  try {
    if (mongoose.connection.readyState === 0) {
      console.log(`[Seed] Connecting to MongoDB: ${MONGODB_URI}`);
      await mongoose.connect(MONGODB_URI);
      console.log('[Seed] Connected successfully.');
    }

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Supplier.deleteMany({}),
      Medicine.deleteMany({}),
      Batch.deleteMany({}),
      StockMovement.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('[Seed] Collections cleared.');

    // 1. Seed Users
    console.log('[Seed] Seeding Users...');
    const adminUser = await User.create({
      name: 'Dr. Alok Verma (Admin)',
      email: 'admin@pharmacare.com',
      password: 'AdminPassword@123',
      role: UserRole.ADMIN,
      phone: '+91 98765 43210',
      isActive: true,
    });

    await User.create({
      name: 'Pharmacy Admin',
      email: 'admin@pharmacy.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
      phone: '+91 98765 00001',
      isActive: true,
    });

    const staffUser = await User.create({
      name: 'Sarah Jenkins (Pharmacist)',
      email: 'pharmacist@pharmacare.com',
      password: 'StaffPassword@123',
      role: UserRole.PHARMACIST,
      phone: '+91 98765 43211',
      isActive: true,
    });

    await User.create({
      name: 'Lead Pharmacist',
      email: 'pharmacist@pharmacy.com',
      password: 'Pharmacist@123',
      role: UserRole.PHARMACIST,
      phone: '+91 98765 00002',
      isActive: true,
    });

    const customerUser = await User.create({
      name: 'Rahul Sharma (Customer)',
      email: 'customer@pharmacare.com',
      password: 'CustomerPassword@123',
      role: UserRole.CUSTOMER,
      phone: '+91 98765 43212',
      isActive: true,
    });

    await User.create({
      name: 'Walk-in Customer Demo',
      email: 'customer@pharmacy.com',
      password: 'Customer@123',
      role: UserRole.CUSTOMER,
      phone: '+91 98765 00003',
      isActive: true,
    });
    console.log(`[Seed] Seeded 3 users. Admin ID: ${adminUser._id}`);

    // 2. Seed Categories
    console.log('[Seed] Seeding Categories...');
    const categoriesData = [
      { name: 'Analgesics & Antipyretics', slug: 'analgesics-antipyretics', description: 'Pain relief and fever reduction medications' },
      { name: 'Antibiotics', slug: 'antibiotics', description: 'Anti-bacterial prescription pharmaceuticals' },
      { name: 'Cardiovascular', slug: 'cardiovascular', description: 'Heart and blood pressure management therapies' },
      { name: 'Antidiabetic', slug: 'antidiabetic', description: 'Blood glucose regulation and insulin management' },
      { name: 'Gastrointestinal', slug: 'gastrointestinal', description: 'Antacids, proton pump inhibitors, and gut health' },
      { name: 'Respiratory', slug: 'respiratory', description: 'Bronchodilators, anti-allergics, and cough syrups' },
      { name: 'Dermatological', slug: 'dermatological', description: 'Topical ointments, creams, and skin therapies' },
      { name: 'Vitamins & Supplements', slug: 'vitamins-supplements', description: 'Nutritional wellness, minerals, and vitamins' },
    ];
    const categories = await Category.insertMany(categoriesData);
    const catMap = new Map(categories.map((c) => [c.name, c._id]));
    console.log(`[Seed] Seeded ${categories.length} categories.`);

    // 3. Seed Suppliers
    console.log('[Seed] Seeding Suppliers...');
    const suppliersData = [
      {
        supplierCode: 'SUP-001',
        name: 'Apex Healthcare Distributors Pvt Ltd',
        contactPerson: 'Rajesh Khanna',
        phone: '+91 91234 56780',
        email: 'orders@apexhealthcare.fictional',
        address: { street: '42 Pharma Industrial Area', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' },
        gstin: '27AAAAA0000A1Z5',
        status: SupplierStatus.ACTIVE,
      },
      {
        supplierCode: 'SUP-002',
        name: 'MedLife Lifesciences Supply Corp',
        contactPerson: 'Meera Nambiar',
        phone: '+91 91234 56781',
        email: 'supply@medlifesciences.fictional',
        address: { street: '15 Biotech Corridor', city: 'Hyderabad', state: 'Telangana', postalCode: '500032' },
        gstin: '36BBBBB1111B2Z6',
        status: SupplierStatus.ACTIVE,
      },
      {
        supplierCode: 'SUP-003',
        name: 'Glenmark Logistics Network',
        contactPerson: 'Amitabh Sengupta',
        phone: '+91 91234 56782',
        email: 'distribution@glenlogistics.fictional',
        address: { street: '88 Ring Road Hub', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
        gstin: '29CCCCC2222C3Z7',
        status: SupplierStatus.ACTIVE,
      },
    ];
    const suppliers = await Supplier.insertMany(suppliersData);
    console.log(`[Seed] Seeded ${suppliers.length} suppliers.`);

    // 4. Seed Medicines
    console.log('[Seed] Seeding Medicines...');
    const medicinesData = [
      {
        medicineCode: 'MED-PARA-500',
        name: 'Paracetamol 500mg Tablets',
        genericName: 'Paracetamol / Acetaminophen',
        brandName: 'Calpol / Crocin Equivalent',
        category: catMap.get('Analgesics & Antipyretics'),
        manufacturer: 'Apex Pharma Labs',
        dosageForm: DosageForm.TABLET,
        strength: '500 mg',
        barcode: '890123400001',
        sku: 'SKU-PARA-500',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 30,
        description: 'Standard antipyretic and mild-to-moderate analgesic.',
        isActive: true,
      },
      {
        medicineCode: 'MED-AMOX-500',
        name: 'Amoxicillin 500mg Capsules',
        genericName: 'Amoxicillin Trihydrate',
        brandName: 'Amoxil Equivalent',
        category: catMap.get('Antibiotics'),
        manufacturer: 'MedLife Lifesciences',
        dosageForm: DosageForm.CAPSULE,
        strength: '500 mg',
        barcode: '890123400002',
        sku: 'SKU-AMOX-500',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 25,
        description: 'Broad spectrum beta-lactam antibiotic.',
        isActive: true,
      },
      {
        medicineCode: 'MED-METF-500',
        name: 'Metformin Hydrochloride 500mg',
        genericName: 'Metformin HCl',
        brandName: 'Glucophage Equivalent',
        category: catMap.get('Antidiabetic'),
        manufacturer: 'Glenmark Logistics Network',
        dosageForm: DosageForm.TABLET,
        strength: '500 mg',
        barcode: '890123400003',
        sku: 'SKU-METF-500',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 40,
        description: 'First-line medication for type 2 diabetes management.',
        isActive: true,
      },
      {
        medicineCode: 'MED-ATOR-020',
        name: 'Atorvastatin 20mg Tablets',
        genericName: 'Atorvastatin Calcium',
        brandName: 'Lipitor Equivalent',
        category: catMap.get('Cardiovascular'),
        manufacturer: 'Apex Pharma Labs',
        dosageForm: DosageForm.TABLET,
        strength: '20 mg',
        barcode: '890123400004',
        sku: 'SKU-ATOR-020',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 20,
        description: 'Statin for lowering blood cholesterol and lipid disorders.',
        isActive: true,
      },
      {
        medicineCode: 'MED-OMEP-020',
        name: 'Omeprazole 20mg Capsules',
        genericName: 'Omeprazole Magnesium',
        brandName: 'Prilosec Equivalent',
        category: catMap.get('Gastrointestinal'),
        manufacturer: 'MedLife Lifesciences',
        dosageForm: DosageForm.CAPSULE,
        strength: '20 mg',
        barcode: '890123400005',
        sku: 'SKU-OMEP-020',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 20,
        description: 'Proton pump inhibitor for gastroesophageal reflux and ulcer treatment.',
        isActive: true,
      },
      {
        medicineCode: 'MED-CETR-010',
        name: 'Cetirizine 10mg Tablets',
        genericName: 'Cetirizine Hydrochloride',
        brandName: 'Zyrtec Equivalent',
        category: catMap.get('Respiratory'),
        manufacturer: 'Glenmark Logistics Network',
        dosageForm: DosageForm.TABLET,
        strength: '10 mg',
        barcode: '890123400006',
        sku: 'SKU-CETR-010',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 20,
        description: 'Second-generation antihistamine for seasonal allergy relief.',
        isActive: true,
      },
      {
        medicineCode: 'MED-VITD-060',
        name: 'Cholecalciferol Vitamin D3 60K',
        genericName: 'Cholecalciferol',
        brandName: 'D-Rise Equivalent',
        category: catMap.get('Vitamins & Supplements'),
        manufacturer: 'Apex Pharma Labs',
        dosageForm: DosageForm.CAPSULE,
        strength: '60000 IU',
        barcode: '890123400007',
        sku: 'SKU-VITD-060',
        unitOfMeasurement: UnitOfMeasurement.STRIP,
        reorderThreshold: 15,
        description: 'High potency vitamin D3 for bone health and deficiency management.',
        isActive: true,
      },
    ];
    const medicines = await Medicine.insertMany(medicinesData);
    const medMap = new Map(medicines.map((m) => [m.medicineCode, m._id]));
    console.log(`[Seed] Seeded ${medicines.length} medicines.`);

    // 5. Seed Batches (Designed specifically for FEFO & alert scenarios)
    console.log('[Seed] Seeding Batches...');
    const now = new Date();

    const addMonths = (date: Date, months: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return d;
    };

    const addDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    const batchesData = [
      // Paracetamol: Batch A expires soonest (2 months), Batch B expires later (8 months), Batch Exp is expired
      {
        medicine: medMap.get('MED-PARA-500'),
        batchNumber: 'PARA-2026-B1',
        supplier: suppliers[0]._id,
        manufacturingDate: addMonths(now, -6),
        expiryDate: addMonths(now, 2), // Earliest active expiry
        purchasePrice: 12.5,
        sellingPrice: 25.0,
        initialQuantity: 50,
        availableQuantity: 30,
      },
      {
        medicine: medMap.get('MED-PARA-500'),
        batchNumber: 'PARA-2026-B2',
        supplier: suppliers[0]._id,
        manufacturingDate: addMonths(now, -2),
        expiryDate: addMonths(now, 10), // Later expiry
        purchasePrice: 13.0,
        sellingPrice: 25.0,
        initialQuantity: 100,
        availableQuantity: 70,
      },
      {
        medicine: medMap.get('MED-PARA-500'),
        batchNumber: 'PARA-2025-EXP',
        supplier: suppliers[0]._id,
        manufacturingDate: addMonths(now, -18),
        expiryDate: addDays(now, -15), // Expired 15 days ago (must NOT be sold)
        purchasePrice: 10.0,
        sellingPrice: 22.0,
        initialQuantity: 30,
        availableQuantity: 30,
      },

      // Amoxicillin: Low-stock scenario (Available: 12, Reorder Threshold: 25)
      {
        medicine: medMap.get('MED-AMOX-500'),
        batchNumber: 'AMOX-2026-A1',
        supplier: suppliers[1]._id,
        manufacturingDate: addMonths(now, -4),
        expiryDate: addMonths(now, 6),
        purchasePrice: 45.0,
        sellingPrice: 85.0,
        initialQuantity: 20,
        availableQuantity: 12, // LOW STOCK TRIGGER
      },

      // Atorvastatin: Near-expiry scenario (Expires in 20 days)
      {
        medicine: medMap.get('MED-ATOR-020'),
        batchNumber: 'ATOR-2026-N1',
        supplier: suppliers[0]._id,
        manufacturingDate: addMonths(now, -11),
        expiryDate: addDays(now, 20), // NEAR-EXPIRY TRIGGER (< 30 days)
        purchasePrice: 65.0,
        sellingPrice: 120.0,
        initialQuantity: 50,
        availableQuantity: 40,
      },

      // Metformin: Healthy active stock
      {
        medicine: medMap.get('MED-METF-500'),
        batchNumber: 'METF-2026-M1',
        supplier: suppliers[2]._id,
        manufacturingDate: addMonths(now, -3),
        expiryDate: addMonths(now, 18),
        purchasePrice: 18.0,
        sellingPrice: 38.0,
        initialQuantity: 150,
        availableQuantity: 120,
      },

      // Omeprazole: Healthy active stock
      {
        medicine: medMap.get('MED-OMEP-020'),
        batchNumber: 'OMEP-2026-O1',
        supplier: suppliers[1]._id,
        manufacturingDate: addMonths(now, -2),
        expiryDate: addMonths(now, 14),
        purchasePrice: 28.0,
        sellingPrice: 55.0,
        initialQuantity: 80,
        availableQuantity: 65,
      },

      // Cetirizine: Healthy active stock
      {
        medicine: medMap.get('MED-CETR-010'),
        batchNumber: 'CETR-2026-C1',
        supplier: suppliers[2]._id,
        manufacturingDate: addMonths(now, -1),
        expiryDate: addMonths(now, 24),
        purchasePrice: 9.5,
        sellingPrice: 20.0,
        initialQuantity: 100,
        availableQuantity: 90,
      },

      // Vitamin D3: Healthy active stock
      {
        medicine: medMap.get('MED-VITD-060'),
        batchNumber: 'VITD-2026-V1',
        supplier: suppliers[0]._id,
        manufacturingDate: addMonths(now, -5),
        expiryDate: addMonths(now, 15),
        purchasePrice: 70.0,
        sellingPrice: 140.0,
        initialQuantity: 60,
        availableQuantity: 45,
      },
    ];

    const batches = await Batch.insertMany(batchesData);
    console.log(`[Seed] Seeded ${batches.length} batches.`);

    // 6. Seed Stock Movement Ledger (Opening balances)
    console.log('[Seed] Seeding initial Stock Movements...');
    const movementsData = batches.map((batch) => ({
      medicine: batch.medicine,
      batch: batch._id,
      movementType: MovementType.OPENING_STOCK,
      quantityAdded: batch.availableQuantity,
      quantityRemoved: 0,
      previousBalance: 0,
      newBalance: batch.availableQuantity,
      reason: 'Initial system opening stock allocation',
      user: adminUser._id,
      relatedTransactionType: 'INITIAL_SEED',
    }));

    await StockMovement.insertMany(movementsData);
    console.log(`[Seed] Seeded ${movementsData.length} stock movement records.`);

    // 7. Seed Initial Audit Log
    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.BATCH,
      entityId: 'ALL_OPENING_BATCHES',
      performedBy: adminUser._id,
      details: { message: 'Database initialized with fictional seed dataset for assessment.' },
    });

    console.log('\n======================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY');
    console.log('======================================================');
    console.log('Demo Credentials:');
    console.log('  Admin:      admin@pharmacare.com      / AdminPassword@123');
    console.log('  Pharmacist: pharmacist@pharmacare.com / StaffPassword@123');
    console.log('  Customer:   customer@pharmacare.com   / CustomerPassword@123');
    console.log('======================================================\n');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    if (needsClose) {
      process.exit(1);
    }
    throw error;
  } finally {
    if (needsClose) {
      await mongoose.connection.close();
      console.log('[Seed] MongoDB connection closed.');
    }
  }
};

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase();
}

export default seedDatabase;
