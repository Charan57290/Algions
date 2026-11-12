import { Router } from 'express';
import {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
} from '../controllers/medicine.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { createMedicineSchema, updateMedicineSchema } from '../validators/masterData.validator.js';

const router = Router();

// Specialized alert endpoint (placed before :id route)
router.get(
  '/alerts/low-stock',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  getLowStockMedicines
);

// Read operations: Accessible by all authenticated users
router.get('/', requireAuth, getAllMedicines);
router.get('/:id', requireAuth, getMedicineById);

// Write operations: Strictly restricted to Admin
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(createMedicineSchema),
  createMedicine
);
router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(updateMedicineSchema),
  updateMedicine
);
router.delete('/:id', requireAuth, requireRole(UserRole.ADMIN), deleteMedicine);

export default router;
