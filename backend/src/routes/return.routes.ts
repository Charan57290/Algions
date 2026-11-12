import { Router } from 'express';
import {
  createReturn,
  getAllReturns,
  getReturnById,
} from '../controllers/return.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import {
  createReturnSchema,
  queryReturnsSchema,
} from '../validators/returnsAndAdjustments.validator.js';

const router = Router();

// Process Customer Return: Accessible by Pharmacist and Admin
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateBody(createReturnSchema),
  createReturn
);

// View Returns History: Accessible by Pharmacist and Admin
router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateQuery(queryReturnsSchema),
  getAllReturns
);

router.get(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  getReturnById
);

export default router;
