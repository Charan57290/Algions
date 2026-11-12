import { Router } from 'express';
import {
  getAllMovements,
  getMovementsByBatch,
  getMovementsByMedicine,
} from '../controllers/movement.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

// Stock ledger audit trail: Strictly accessible by Admin and Pharmacist
router.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.PHARMACIST));

router.get('/', getAllMovements);
router.get('/batch/:batchId', getMovementsByBatch);
router.get('/medicine/:medicineId', getMovementsByMedicine);

export default router;
