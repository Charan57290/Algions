import { Router } from 'express';
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
} from '../controllers/purchase.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { receivePurchaseSchema } from '../validators/inventory.validator.js';

const router = Router();

// Read operations: Accessible by Admin and Pharmacist
router.get('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getAllPurchases);
router.get('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST), getPurchaseById);

// Receive new purchase stock: Accessible by Admin and Pharmacist (Staff receiving goods)
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateBody(receivePurchaseSchema),
  createPurchase
);

export default router;
