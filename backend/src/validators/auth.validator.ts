import { z } from 'zod';
import { UserRole } from '../models/User.js';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
  role: z
    .nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) })
    .optional()
    .default(UserRole.CUSTOMER),
  phone: z.string().trim().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  phone: z.string().trim().optional(),
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
