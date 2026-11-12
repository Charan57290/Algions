import { Router } from 'express';
import { login, register, getMe, updateProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, validateBody(updateProfileSchema), updateProfile);

export default router;
