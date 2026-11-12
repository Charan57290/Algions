import { Request, Response, NextFunction } from 'express';
import { Supplier, SupplierStatus } from '../models/Supplier.js';
import { Batch } from '../models/Batch.js';
import { Purchase } from '../models/Purchase.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';

export const getAllSuppliers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.status && Object.values(SupplierStatus).includes(req.query.status as SupplierStatus)) {
      query.status = req.query.status;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { supplierCode: searchRegex },
        { name: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const [suppliers, total] = await Promise.all([
      Supplier.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Supplier.countDocuments(query),
    ]);

    // Aggregate supplier batch counts
    const batchCounts = await Batch.aggregate([
      { $group: { _id: '$supplier', count: { $sum: 1 } } },
    ]);
    const batchMap = new Map(batchCounts.map((b) => [b._id.toString(), b.count]));

    const result = suppliers.map((sup) => ({
      ...sup.toObject(),
      totalBatchesSupplied: batchMap.get(sup._id.toString()) || 0,
    }));

    res.status(200).json({
      success: true,
      data: result,
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

export const getSupplierById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
      return;
    }

    const [totalBatches, totalPurchases] = await Promise.all([
      Batch.countDocuments({ supplier: supplier._id }),
      Purchase.countDocuments({ supplier: supplier._id }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...supplier.toObject(),
        totalBatches,
        totalPurchases,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { supplierCode, name, contactPerson, phone, email, address, gstin, status } = req.body;

    const existingCode = await Supplier.findOne({
      supplierCode: supplierCode.toUpperCase().trim(),
    });
    if (existingCode) {
      res.status(409).json({
        success: false,
        message: `Supplier with code '${supplierCode}' already exists.`,
      });
      return;
    }

    const supplier = await Supplier.create({
      supplierCode: supplierCode.toUpperCase().trim(),
      name,
      contactPerson,
      phone,
      email,
      address,
      gstin,
      status: status || SupplierStatus.ACTIVE,
    });

    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.SUPPLIER,
      entityId: supplier._id.toString(),
      performedBy: req.user?._id,
      details: { supplierCode: supplier.supplierCode, name: supplier.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
      return;
    }

    const { supplierCode, name, contactPerson, phone, email, address, gstin, status } = req.body;

    if (supplierCode && supplierCode.toUpperCase().trim() !== supplier.supplierCode) {
      const existing = await Supplier.findOne({
        supplierCode: supplierCode.toUpperCase().trim(),
        _id: { $ne: supplier._id },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Supplier with code '${supplierCode}' already exists.`,
        });
        return;
      }
      supplier.supplierCode = supplierCode.toUpperCase().trim();
    }

    if (name) supplier.name = name;
    if (contactPerson) supplier.contactPerson = contactPerson;
    if (phone) supplier.phone = phone;
    if (email) supplier.email = email;
    if (address !== undefined) supplier.address = address;
    if (gstin !== undefined) supplier.gstin = gstin;
    if (status !== undefined) supplier.status = status;

    await supplier.save();

    await AuditLog.create({
      action: AuditAction.UPDATE,
      entity: AuditEntity.SUPPLIER,
      entityId: supplier._id.toString(),
      performedBy: req.user?._id,
      details: { updatedFields: req.body },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
      return;
    }

    // Check if supplier has batches or purchase history
    const [batchesCount, purchasesCount] = await Promise.all([
      Batch.countDocuments({ supplier: supplier._id }),
      Purchase.countDocuments({ supplier: supplier._id }),
    ]);

    if (batchesCount > 0 || purchasesCount > 0) {
      // Deactivate instead of hard deletion to preserve historical transactions
      supplier.status = SupplierStatus.INACTIVE;
      await supplier.save();

      await AuditLog.create({
        action: AuditAction.STATUS_CHANGE,
        entity: AuditEntity.SUPPLIER,
        entityId: supplier._id.toString(),
        performedBy: req.user?._id,
        details: { message: 'Deactivated supplier due to historical transaction records' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: `Supplier '${supplier.name}' has historical inventory records and was safely deactivated instead of deleted.`,
        data: supplier,
      });
      return;
    }

    await Supplier.findByIdAndDelete(supplier._id);

    await AuditLog.create({
      action: AuditAction.DELETE,
      entity: AuditEntity.SUPPLIER,
      entityId: supplier._id.toString(),
      performedBy: req.user?._id,
      details: { deletedSupplier: supplier.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Supplier '${supplier.name}' deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplierPurchases = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
      return;
    }

    const purchases = await Purchase.find({ supplier: supplier._id })
      .populate('receivedBy', 'name email')
      .populate('items.medicine', 'name genericName medicineCode')
      .sort({ purchaseDate: -1 });

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};
