import { Router } from 'express';
import {
  getDashboardKPIs,
  getSalesReport,
  getInventoryReport,
  getValuationReport,
  getExpiryReport,
  getReconciliationReportController,
} from '../controllers/report.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

// Reports access: Strictly Admin and Pharmacist
router.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST));

router.get('/dashboard', getDashboardKPIs);
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/valuation', getValuationReport);
router.get('/expiry', getExpiryReport);
router.get('/expiry-risk', getExpiryReport);
router.get('/reconciliation', getReconciliationReportController);

export default router;
