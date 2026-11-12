import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
} from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { UserRole } from '../models/User.js';
import { updateUserStatusSchema, updateUserRoleSchema } from '../validators/auth.validator.js';

const router = Router();

// All user management routes require ADMIN role
router.use(requireAuth, requireRole(UserRole.ADMIN));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/status', validateBody(updateUserStatusSchema), updateUserStatus);
router.patch('/:id/role', validateBody(updateUserRoleSchema), updateUserRole);

export default router;
