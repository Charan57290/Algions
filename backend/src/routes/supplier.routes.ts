import { Router } from 'express';
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierPurchases,
} from '../controllers/supplier.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { createSupplierSchema, updateSupplierSchema } from '../validators/masterData.validator.js';

const router = Router();

// Read operations: Accessible by Admin and Pharmacist
router.get('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getAllSuppliers);
router.get('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getSupplierById);
router.get(
  '/:id/purchases',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  getSupplierPurchases
);

// Write operations: Restricted to Admin
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(createSupplierSchema),
  createSupplier
);
router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(updateSupplierSchema),
  updateSupplier
);
router.delete('/:id', requireAuth, requireRole(UserRole.ADMIN), deleteSupplier);

export default router;
