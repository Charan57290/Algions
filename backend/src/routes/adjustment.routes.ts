import { Router } from 'express';
import {
  createAdjustment,
  getAllAdjustments,
  getAdjustmentById,
} from '../controllers/adjustment.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import {
  createAdjustmentSchema,
  queryAdjustmentsSchema,
} from '../validators/returnsAndAdjustments.validator.js';

const router = Router();

// Process Stock Adjustment (Audited stocktake discrepancies): Strictly Admin & Pharmacist
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateBody(createAdjustmentSchema),
  createAdjustment
);

router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateQuery(queryAdjustmentsSchema),
  getAllAdjustments
);

router.get(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  getAdjustmentById
);

export default router;
