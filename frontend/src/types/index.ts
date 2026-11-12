export type UserRole = 'ADMIN' | 'PHARMACIST' | 'CUSTOMER';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  gstin?: string;
  isActive: boolean;
  createdAt: string;
}

export type DosageForm =
  | 'TABLET'
  | 'CAPSULE'
  | 'SYRUP'
  | 'INJECTION'
  | 'OINTMENT'
  | 'DROPS'
  | 'INHALER'
  | 'POWDER'
  | 'OTHER';

export interface Medicine {
  _id: string;
  name: string;
  genericName: string;
  brandName?: string;
  category: Category | string;
  manufacturer: string;
  description?: string;
  dosageForm: DosageForm;
  strength: string;
  barcode?: string;
  sku: string;
  unitOfMeasurement: string;
  reorderThreshold: number;
  requiresPrescription: boolean;
  isActive: boolean;
  createdAt: string;
  totalAvailableStock?: number;
  isLowStock?: boolean;
}

export interface Batch {
  _id: string;
  batchNumber: string;
  medicine: Medicine | string;
  supplier: Supplier | string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  initialQuantity: number;
  availableQuantity: number;
  isRecalled?: boolean;
  createdAt: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'NEAR_EXPIRY' | 'DEPLETED';
  daysUntilExpiry?: number;
}

export interface FefoAllocationPreviewItem {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  allocatedQuantity: number;
  unitPrice: number;
  purchasePrice: number;
  itemTotal: number;
}

export interface FefoPreviewResponse {
  medicineId: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  isFullyAllocated: boolean;
  allocations: FefoAllocationPreviewItem[];
  subtotal: number;
}

export interface SaleItem {
  medicine: Medicine | string;
  batch: Batch | string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  purchasePriceSnapshot: number;
  totalPrice: number;
}

export interface Sale {
  _id: string;
  invoiceNumber: string;
  items: SaleItem[];
  customerName?: string;
  customerPhone?: string;
  doctorName?: string;
  prescriptionNumber?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING';
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  cashier: User | string;
  notes?: string;
  createdAt: string;
}

export interface InvoicePayload {
  pharmacyDetails: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
    gstin: string;
    dlNumber: string;
  };
  invoice: {
    invoiceNumber: string;
    date: string;
    cashierName: string;
    customerName: string;
    customerPhone: string;
    doctorName?: string;
    paymentMethod: string;
    paymentStatus: string;
  };
  items: Array<{
    itemNumber: number;
    medicineName: string;
    strength: string;
    dosageForm: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  financialSummary: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    netPayable: number;
    totalSavings: number;
  };
  termsAndConditions: string[];
}

export interface StockMovement {
  _id: string;
  batch: Batch | string;
  medicine: Medicine | string;
  movementType: string;
  previousBalance: number;
  quantityAdded: number;
  quantityRemoved: number;
  newBalance: number;
  referenceType?: string;
  referenceId?: string;
  performedBy: User | string;
  reason?: string;
  createdAt: string;
}

export interface PurchaseItem {
  medicine: Medicine | string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
}

export interface Purchase {
  _id: string;
  purchaseOrderNumber: string;
  supplier: Supplier | string;
  supplierInvoiceNumber: string;
  receivedDate: string;
  items: Array<{
    medicine: Medicine | string;
    batch: Batch | string;
    batchNumber: string;
    quantityReceived: number;
    purchasePrice: number;
    sellingPrice: number;
    totalAmount: number;
  }>;
  totalAmount: number;
  notes?: string;
  receivedBy: User | string;
  createdAt: string;
}

export interface ReturnRecord {
  _id: string;
  returnNumber: string;
  originalSale: Sale | string;
  invoiceNumber: string;
  items: Array<{
    batch: Batch | string;
    medicine: Medicine | string;
    batchNumber: string;
    quantityReturned: number;
    refundUnitPrice: number;
    refundSubtotal: number;
    restocked: boolean;
    condition: 'UNDAMAGED' | 'DAMAGED' | 'EXPIRED';
  }>;
  totalRefundAmount: number;
  reason: string;
  processedBy: User | string;
  createdAt: string;
}

export interface StockAdjustment {
  _id: string;
  adjustmentNumber: string;
  batch: Batch | string;
  medicine: Medicine | string;
  adjustmentType: 'INCREASE' | 'DECREASE';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reasonCode: 'COUNT_CORRECTION' | 'DAMAGE' | 'EXPIRED_SCRAPPED' | 'THEFT' | 'BREAKAGE' | 'OTHER';
  remarks: string;
  adjustedBy: User | string;
  createdAt: string;
}

export interface DashboardKPIs {
  inventory: {
    totalBatches: number;
    totalMedicines: number;
    lowStockCount: number;
    expiringWithin30DaysCount: number;
    expiredBatchesCount: number;
  };
  valuation: {
    totalPurchaseValuation: number;
    totalRetailValuation: number;
    potentialGrossMargin: number;
    expiredValuationLoss: number;
  };
  salesPerformance: {
    salesCount: number;
    grossSalesRevenue: number;
    netSalesRevenue: number;
    totalCogs: number;
    grossProfit: number;
    profitMarginPercent: number;
    totalUnitsSold: number;
  };
  recentSales: Sale[];
  expiringBatches: Batch[];
  lowStockMedicines: Medicine[];
  sevenDayTrend: Array<{
    date: string;
    revenue: number;
    cogs: number;
    margin: number;
    orderCount: number;
  }>;
}

export interface ExpiryRiskCategory {
  riskLevel: 'EXPIRED' | 'CRITICAL' | 'HIGH' | 'MODERATE' | 'HEALTHY';
  title: string;
  description: string;
  count: number;
  totalUnits: number;
  costValue: number;
  batches: Batch[];
}

export interface ReconciliationReport {
  summary: {
    totalActiveBatchesAudited: number;
    discrepancyCount: number;
    auditPassed: boolean;
    generatedAt: string;
  };
  discrepancies: Array<{
    batchId: string;
    batchNumber: string;
    medicineName: string;
    recordedBalance: number;
    calculatedBalance: number;
    discrepancy: number;
  }>;
}
