import { Router } from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  getSaleInvoice,
  previewBatchFefo,
} from '../controllers/sale.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { createSaleSchema, querySalesSchema } from '../validators/sale.validator.js';

const router = Router();

// Process Sale Checkout (POS Cashier role): Accessible by Admin and Pharmacist
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateBody(createSaleSchema),
  createSale
);

// View Sales History: Accessible by Admin and Pharmacist
router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  validateQuery(querySalesSchema),
  getAllSales
);

// FEFO Batch Allocation Preview
router.post(
  '/preview-fefo',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST),
  previewBatchFefo
);

// View Single Sale Record
router.get(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CUSTOMER),
  getSaleById
);

// Get Printable Invoice Payload
router.get(
  '/:id/invoice',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CUSTOMER),
  getSaleInvoice
);

export default router;
