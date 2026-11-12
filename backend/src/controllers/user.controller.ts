import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/User.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.role && Object.values(UserRole).includes(req.query.role as UserRole)) {
      query.role = req.query.role;
    }

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isActive } = req.body;
    const targetUserId = req.params.id;

    if (req.user && req.user._id.toString() === targetUserId && !isActive) {
      res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own active account.',
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    await AuditLog.create({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      performedBy: req.user?._id,
      details: { previousStatus: !isActive, newStatus: isActive },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    await AuditLog.create({
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      performedBy: req.user?._id,
      details: { updatedRole: role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
