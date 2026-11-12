import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { createCategorySchema, updateCategorySchema } from '../validators/masterData.validator.js';

const router = Router();

// Read operations: Accessible by authenticated users (Admin, Pharmacist, Customer)
router.get('/', requireAuth, getAllCategories);
router.get('/:id', requireAuth, getCategoryById);

// Write operations: Strictly restricted to Admin
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(createCategorySchema),
  createCategory
);
router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(updateCategorySchema),
  updateCategory
);
router.delete('/:id', requireAuth, requireRole(UserRole.ADMIN), deleteCategory);

export default router;
