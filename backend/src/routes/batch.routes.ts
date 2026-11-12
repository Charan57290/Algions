import { Router } from 'express';
import {
  getAllBatches,
  getBatchById,
  createManualBatch,
  getFefoPreview,
  getValuationReport,
  getNearExpiryAlerts,
} from '../controllers/batch.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import {
  createBatchSchema,
  fefoPreviewQuerySchema,
  nearExpiryQuerySchema,
} from '../validators/inventory.validator.js';

const router = Router();

// Specialized reports & previews (declared before :id)
router.get(
  '/fefo-preview',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateQuery(fefoPreviewQuerySchema),
  getFefoPreview
);

router.get(
  '/valuation',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  getValuationReport
);

router.get(
  '/alerts/near-expiry',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateQuery(nearExpiryQuerySchema),
  getNearExpiryAlerts
);

// General batch routes
router.get('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getAllBatches);
router.get('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getBatchById);

// Manual batch registration (Restricted to Admin)
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(createBatchSchema),
  createManualBatch
);

export default router;
