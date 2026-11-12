import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/User.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';
import { generateToken } from '../utils/jwt.js';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Record login audit event
    await AuditLog.create({
      action: AuditAction.LOGIN,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      performedBy: user._id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
      return;
    }

    // Strict Security Guard: Prevent unauthenticated users from escalating to ADMIN
    if (role === UserRole.ADMIN) {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Registering an Administrator account requires an active Administrator session.',
        });
        return;
      }
    }

    // Default to CUSTOMER or PHARMACIST for public registrations
    const userRole = role || UserRole.CUSTOMER;

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      phone,
      isActive: true,
    });

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Audit creation
    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      performedBy: req.user ? req.user._id : user._id,
      details: { name: user.name, email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone,
      isActive: req.user.isActive,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt,
    },
  });
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { name, phone, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password is required to set a new password.',
        });
        return;
      }

      const isCurrentMatch = await user.comparePassword(currentPassword);
      if (!isCurrentMatch) {
        res.status(400).json({
          success: false,
          message: 'Current password does not match records.',
        });
        return;
      }

      user.password = newPassword; // Will be hashed by pre-save hook
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};
