import { Request, Response, NextFunction } from 'express';
import { Category } from '../models/Category.js';
import { Medicine } from '../models/Medicine.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';

export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const categories = await Category.find(filter).sort({ name: 1 });

    // Aggregate medicine count per category
    const counts = await Medicine.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const result = categories.map((cat) => ({
      ...cat.toObject(),
      medicineCount: countMap.get(cat._id.toString()) || 0,
    }));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    const medicineCount = await Medicine.countDocuments({ category: category._id });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        medicineCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Category with name '${name}' already exists.`,
      });
      return;
    }

    const category = await Category.create({ name, description, isActive });

    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.CATEGORY,
      entityId: category._id.toString(),
      performedBy: req.user?._id,
      details: { name: category.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    if (name && name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: category._id },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Category with name '${name}' already exists.`,
        });
        return;
      }
      category.name = name;
    }

    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    await AuditLog.create({
      action: AuditAction.UPDATE,
      entity: AuditEntity.CATEGORY,
      entityId: category._id.toString(),
      performedBy: req.user?._id,
      details: { updatedFields: req.body },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Safety check: verify no medicines are categorized under this category
    const medicinesCount = await Medicine.countDocuments({ category: category._id });
    if (medicinesCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category '${category.name}' because ${medicinesCount} medicine(s) are associated with it. Please reassign those medicines first or deactivate the category.`,
      });
      return;
    }

    await Category.findByIdAndDelete(category._id);

    await AuditLog.create({
      action: AuditAction.DELETE,
      entity: AuditEntity.CATEGORY,
      entityId: category._id.toString(),
      performedBy: req.user?._id,
      details: { deletedCategory: category.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Category '${category.name}' deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};
