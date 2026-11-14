import axios from 'axios';
import type {
  AuthResponse,
  Category,
  Supplier,
  Medicine,
  Batch,
  FefoPreviewResponse,
  Sale,
  InvoicePayload,
  Purchase,
  ReturnRecord,
  StockAdjustment,
  StockMovement,
  DashboardKPIs,
  ExpiryRiskCategory,
  ReconciliationReport,
  User,
} from '../types';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401 Unauthorized to auto-logout expired sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------------
// Authentication & Profile Services
// -------------------------------------------------------------
export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', credentials);
    return res.data.data || res.data;
  },
  register: async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> => {
    const res = await api.post('/auth/register', data);
    return res.data.data || res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data.data || res.data.user || res.data;
  },
  updateProfile: async (data: {
    name?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<User> => {
    const res = await api.put('/auth/profile', data);
    return res.data.data || res.data.user || res.data;
  },
  getAllUsers: async (): Promise<User[]> => {
    const res = await api.get('/users');
    const payload = res.data.data;
    return Array.isArray(payload) ? payload : (payload?.users || res.data.users || []);
  },
  toggleUserStatus: async (userId: string, isActive: boolean): Promise<User> => {
    const res = await api.patch(`/users/${userId}/status`, { isActive });
    return res.data.data || res.data;
  },
};

// -------------------------------------------------------------
// Master Data Services (Categories, Suppliers, Medicines)
// -------------------------------------------------------------
export const masterDataApi = {
  getCategories: async (params?: { search?: string; isActive?: boolean }): Promise<Category[]> => {
    const res = await api.get('/categories', { params });
    const payload = res.data.data;
    return Array.isArray(payload) ? payload : (payload?.categories || res.data.categories || []);
  },
  createCategory: async (data: { name: string; description?: string }): Promise<Category> => {
    const res = await api.post('/categories', data);
    return res.data.data;
  },
  updateCategory: async (id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<Category> => {
    const res = await api.put(`/categories/${id}`, data);
    return res.data.data;
  },
  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },

  getSuppliers: async (params?: { search?: string; isActive?: boolean }): Promise<Supplier[]> => {
    const res = await api.get('/suppliers', { params });
    const payload = res.data.data;
    return Array.isArray(payload) ? payload : (payload?.suppliers || res.data.suppliers || []);
  },
  createSupplier: async (data: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address?: string;
    gstin?: string;
  }): Promise<Supplier> => {
    const res = await api.post('/suppliers', data);
    return res.data.data;
  },
  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    const res = await api.put(`/suppliers/${id}`, data);
    return res.data.data;
  },

  getMedicines: async (params?: {
    search?: string;
    category?: string;
    dosageForm?: string;
    lowStockOnly?: boolean;
    isActive?: boolean;
    limit?: number;
    page?: number;
  }): Promise<{ medicines: Medicine[]; total: number; page: number; totalPages: number }> => {
    const res = await api.get('/medicines', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.medicines || res.data.medicines || []);
    const total = res.data.pagination?.total ?? items.length;
    const page = res.data.pagination?.page ?? 1;
    const totalPages = res.data.pagination?.totalPages ?? (res.data.pagination?.pages ?? 1);
    return { medicines: items, total, page, totalPages };
  },
  getMedicineById: async (id: string): Promise<Medicine> => {
    const res = await api.get(`/medicines/${id}`);
    return res.data.data;
  },
  createMedicine: async (data: Partial<Medicine>): Promise<Medicine> => {
    const res = await api.post('/medicines', data);
    return res.data.data;
  },
  updateMedicine: async (id: string, data: Partial<Medicine>): Promise<Medicine> => {
    const res = await api.put(`/medicines/${id}`, data);
    return res.data.data;
  },
  deleteMedicine: async (id: string): Promise<void> => {
    await api.delete(`/medicines/${id}`);
  },
};

// -------------------------------------------------------------
// Inventory, Batches, Purchases & Movement Ledger
// -------------------------------------------------------------
export const inventoryApi = {
  getBatches: async (params?: {
    medicine?: string;
    status?: string;
    search?: string;
    limit?: number;
    page?: number;
  }): Promise<{ batches: Batch[]; total: number }> => {
    const res = await api.get('/batches', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.batches || res.data.batches || []);
    const total = res.data.pagination?.total ?? items.length;
    return { batches: items, total };
  },
  getInventoryValuation: async (): Promise<{
    totalBatchesCount: number;
    totalAvailableUnits: number;
    totalCostValuation: number;
    totalRetailValuation: number;
    potentialGrossProfit: number;
    expiredBatchesCount: number;
    expiredValuationLoss: number;
  }> => {
    const res = await api.get('/batches/valuation');
    const raw = res.data.data || res.data;
    if (raw?.activeInventory) {
      return {
        totalCostValuation: raw.activeInventory.totalCostValue || 0,
        totalAvailableUnits: raw.activeInventory.totalUnits || 0,
        totalRetailValuation: raw.activeInventory.totalRetailValue || 0,
        potentialGrossProfit: raw.activeInventory.expectedGrossProfit || 0,
        totalBatchesCount: raw.activeInventory.batchCount || 0,
        expiredValuationLoss: raw.expiredInventory?.totalLossCost || 0,
        expiredBatchesCount: raw.expiredInventory?.batchCount || 0,
        ...raw,
      };
    }
    return raw;
  },
  getPurchases: async (params?: { limit?: number; page?: number }): Promise<{ purchases: Purchase[]; total: number }> => {
    const res = await api.get('/purchases', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.purchases || res.data.purchases || []);
    const total = res.data.pagination?.total ?? items.length;
    return { purchases: items, total };
  },
  createPurchase: async (data: {
    supplier: string;
    supplierInvoiceNumber: string;
    receivedDate?: string;
    items: Array<{
      medicine: string;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      purchasePrice: number;
      sellingPrice: number;
      quantity: number;
    }>;
    notes?: string;
  }): Promise<Purchase> => {
    const res = await api.post('/purchases', data);
    return res.data.data;
  },
  getStockMovements: async (params?: {
    batch?: string;
    medicine?: string;
    movementType?: string;
    limit?: number;
  }): Promise<StockMovement[]> => {
    const res = await api.get('/movements', { params });
    const payload = res.data.data;
    return Array.isArray(payload) ? payload : (payload?.movements || res.data.movements || []);
  },
};

// -------------------------------------------------------------
// Sales, POS Checkout & Invoicing
// -------------------------------------------------------------
export const saleApi = {
  previewFefo: async (items: Array<{ medicineId: string; quantity: number }>): Promise<FefoPreviewResponse[]> => {
    const res = await api.post('/sales/preview-fefo', { items });
    return res.data.data;
  },
  createSale: async (data: {
    items: Array<{ medicineId: string; quantity: number; discountPercent?: number }>;
    customerName?: string;
    customerPhone?: string;
    doctorName?: string;
    prescriptionNumber?: string;
    paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING';
    discountAmount?: number;
    notes?: string;
  }): Promise<Sale> => {
    const res = await api.post('/sales', data);
    return res.data.data;
  },
  getSales: async (params?: {
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    page?: number;
  }): Promise<{ sales: Sale[]; total: number }> => {
    const res = await api.get('/sales', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.sales || res.data.sales || []);
    const total = res.data.pagination?.total ?? items.length;
    return { sales: items, total };
  },
  getSaleById: async (id: string): Promise<Sale> => {
    const res = await api.get(`/sales/${id}`);
    return res.data.data;
  },
  getInvoice: async (id: string): Promise<InvoicePayload> => {
    const res = await api.get(`/sales/${id}/invoice`);
    return res.data.data;
  },
};

// -------------------------------------------------------------
// Returns & Adjustments Services
// -------------------------------------------------------------
export const returnApi = {
  createReturn: async (data: {
    saleId: string;
    reason: string;
    items: Array<{
      batchId: string;
      quantity: number;
      restock: boolean;
      condition: 'UNDAMAGED' | 'DAMAGED' | 'EXPIRED';
    }>;
  }): Promise<ReturnRecord> => {
    const res = await api.post('/returns', data);
    return res.data.data;
  },
  getReturns: async (params?: { limit?: number; page?: number }): Promise<{ returns: ReturnRecord[]; total: number }> => {
    const res = await api.get('/returns', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.returns || res.data.returns || []);
    const total = res.data.pagination?.total ?? items.length;
    return { returns: items, total };
  },
};

export const adjustmentApi = {
  createAdjustment: async (data: {
    batchId: string;
    adjustmentType: 'INCREASE' | 'DECREASE';
    quantity: number;
    reasonCode: 'COUNT_CORRECTION' | 'DAMAGE' | 'EXPIRED_SCRAPPED' | 'THEFT' | 'BREAKAGE' | 'OTHER';
    remarks: string;
  }): Promise<StockAdjustment> => {
    const res = await api.post('/adjustments', data);
    return res.data.data;
  },
  getAdjustments: async (params?: { limit?: number; page?: number }): Promise<{ adjustments: StockAdjustment[]; total: number }> => {
    const res = await api.get('/adjustments', { params });
    const payload = res.data.data;
    const items = Array.isArray(payload) ? payload : (payload?.adjustments || res.data.adjustments || []);
    const total = res.data.pagination?.total ?? items.length;
    return { adjustments: items, total };
  },
};

// -------------------------------------------------------------
// Analytical Reports Services
// -------------------------------------------------------------
export const reportApi = {
  getDashboardKPIs: async (): Promise<DashboardKPIs> => {
    const res = await api.get('/reports/dashboard');
    return res.data.data;
  },
  getSalesReport: async (params?: { startDate?: string; endDate?: string }): Promise<any> => {
    const res = await api.get('/reports/sales', { params });
    const payload = res.data.data || res.data;
    if (payload) {
      const metrics = payload.metrics || {};
      payload.summary = payload.summary || {
        netRevenue: metrics.netRevenue || 0,
        totalTransactions: metrics.transactionCount || 0,
        totalCogs: metrics.costOfGoodsSold || 0,
        grossProfit: metrics.grossProfit || 0,
        profitMarginPercent: metrics.grossMarginPercent || 0,
        totalTax: metrics.totalTax || 0,
        grossRevenue: metrics.grossRevenue || 0,
        totalDiscounts: metrics.totalDiscounts || 0,
      };
    }
    return payload;
  },
  getExpiryRiskReport: async (): Promise<ExpiryRiskCategory[]> => {
    try {
      const res = await api.get('/reports/expiry-risk');
      const payload = res.data.data || res.data;
      return Array.isArray(payload) ? payload : [];
    } catch {
      const res = await api.get('/reports/expiry');
      const payload = res.data.data || res.data;
      return Array.isArray(payload) ? payload : [];
    }
  },
  getReconciliationReport: async (): Promise<ReconciliationReport> => {
    const res = await api.get('/reports/reconciliation');
    const raw = res.data.data || res.data;
    if (raw && !raw.summary) {
      const disc = (raw.batches || [])
        .filter((b: any) => !b.isReconciled || b.variance !== 0)
        .map((b: any) => ({
          batchId: b.batchId?.toString() || b._id,
          batchNumber: b.batchNumber,
          medicineName: b.medicineName || 'Medicine',
          recordedBalance: b.currentActualStock ?? 0,
          calculatedBalance: b.ledgerCalculatedStock ?? 0,
          discrepancy: b.variance ?? 0,
        }));
      return {
        summary: {
          totalActiveBatchesAudited: raw.totalBatchesAudited ?? (raw.batches?.length || 0),
          discrepancyCount: raw.totalDiscrepancies ?? disc.length,
          auditPassed: (raw.totalDiscrepancies === 0 || raw.reconciliationStatus === 'PERFECTLY_RECONCILED'),
          generatedAt: raw.reconciliationTimestamp || new Date().toISOString(),
        },
        discrepancies: disc,
        ...raw,
      };
    }
    return raw;
  },
};
