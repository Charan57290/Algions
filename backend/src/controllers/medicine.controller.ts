import { Request, Response, NextFunction } from 'express';
import { Medicine, DosageForm } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { Category } from '../models/Category.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';

export const getAllMedicines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.dosageForm && Object.values(DosageForm).includes(req.query.dosageForm as DosageForm)) {
      query.dosageForm = req.query.dosageForm;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { name: searchRegex },
        { genericName: searchRegex },
        { brandName: searchRegex },
        { medicineCode: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { manufacturer: searchRegex },
      ];
    }

    let sort: Record<string, 1 | -1> = { name: 1 };
    if (req.query.sortBy) {
      const field = req.query.sortBy as string;
      const order = req.query.order === 'desc' ? -1 : 1;
      sort = { [field]: order };
    }

    const [medicines, total] = await Promise.all([
      Medicine.find(query).populate('category', 'name slug').sort(sort).skip(skip).limit(limit),
      Medicine.countDocuments(query),
    ]);

    // Aggregate real-time stock balances across batches for these medicines
    const medicineIds = medicines.map((m) => m._id);
    const today = new Date();

    const stockAggregates = await Batch.aggregate([
      { $match: { medicine: { $in: medicineIds } } },
      {
        $group: {
          _id: '$medicine',
          totalAvailableStock: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$expiryDate', today] }, { $gt: ['$availableQuantity', 0] }] }, '$availableQuantity', 0],
            },
          },
          expiredStock: {
            $sum: {
              $cond: [{ $lte: ['$expiryDate', today] }, '$availableQuantity', 0],
            },
          },
          batchCount: { $sum: 1 },
        },
      },
    ]);

    const stockMap = new Map(
      stockAggregates.map((s) => [
        s._id.toString(),
        {
          totalAvailableStock: s.totalAvailableStock,
          expiredStock: s.expiredStock,
          batchCount: s.batchCount,
        },
      ])
    );

    const enrichedMedicines = medicines.map((med) => {
      const stock = stockMap.get(med._id.toString()) || {
        totalAvailableStock: 0,
        expiredStock: 0,
        batchCount: 0,
      };

      const isLowStock = stock.totalAvailableStock <= med.reorderThreshold;

      return {
        ...med.toObject(),
        totalAvailableStock: stock.totalAvailableStock,
        expiredStock: stock.expiredStock,
        batchCount: stock.batchCount,
        isLowStock,
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedMedicines,
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

export const getMedicineById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const medicine = await Medicine.findById(req.params.id).populate('category', 'name slug description');
    if (!medicine) {
      res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
      return;
    }

    // Retrieve active and non-active batches for this medicine
    const batches = await Batch.find({ medicine: medicine._id })
      .populate('supplier', 'name supplierCode phone')
      .sort({ expiryDate: 1 });

    const today = new Date();
    let totalAvailableStock = 0;
    let expiredStock = 0;

    const batchesWithStatus = batches.map((b) => {
      const isExpired = new Date(b.expiryDate) <= today;
      if (!isExpired && b.availableQuantity > 0) {
        totalAvailableStock += b.availableQuantity;
      } else if (isExpired) {
        expiredStock += b.availableQuantity;
      }

      return {
        ...b.toObject(),
        isExpired,
      };
    });

    const isLowStock = totalAvailableStock <= medicine.reorderThreshold;

    res.status(200).json({
      success: true,
      data: {
        ...medicine.toObject(),
        totalAvailableStock,
        expiredStock,
        isLowStock,
        batches: batchesWithStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createMedicine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      medicineCode,
      name,
      genericName,
      brandName,
      category,
      manufacturer,
      description,
      dosageForm,
      strength,
      barcode,
      sku,
      unitOfMeasurement,
      reorderThreshold,
      isActive,
    } = req.body;

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      res.status(400).json({
        success: false,
        message: 'Specified category does not exist.',
      });
      return;
    }

    // Check unique constraints: medicineCode, SKU, barcode
    const [codeMatch, skuMatch] = await Promise.all([
      Medicine.findOne({ medicineCode: medicineCode.toUpperCase().trim() }),
      Medicine.findOne({ sku: sku.toUpperCase().trim() }),
    ]);

    if (codeMatch) {
      res.status(409).json({
        success: false,
        message: `Medicine code '${medicineCode}' is already registered.`,
      });
      return;
    }

    if (skuMatch) {
      res.status(409).json({
        success: false,
        message: `SKU '${sku}' is already registered.`,
      });
      return;
    }

    if (barcode) {
      const barcodeMatch = await Medicine.findOne({ barcode: barcode.trim() });
      if (barcodeMatch) {
        res.status(409).json({
          success: false,
          message: `Barcode '${barcode}' is already assigned to another medicine.`,
        });
        return;
      }
    }

    const medicine = await Medicine.create({
      medicineCode: medicineCode.toUpperCase().trim(),
      name,
      genericName,
      brandName,
      category,
      manufacturer,
      description,
      dosageForm,
      strength,
      barcode: barcode ? barcode.trim() : undefined,
      sku: sku.toUpperCase().trim(),
      unitOfMeasurement,
      reorderThreshold,
      isActive: isActive !== undefined ? isActive : true,
    });

    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.MEDICINE,
      entityId: medicine._id.toString(),
      performedBy: req.user?._id,
      details: { medicineCode: medicine.medicineCode, name: medicine.name, sku: medicine.sku },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Medicine registered successfully',
      data: medicine,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMedicine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
      return;
    }

    const {
      medicineCode,
      name,
      genericName,
      brandName,
      category,
      manufacturer,
      description,
      dosageForm,
      strength,
      barcode,
      sku,
      unitOfMeasurement,
      reorderThreshold,
      isActive,
    } = req.body;

    if (category && category !== medicine.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        res.status(400).json({
          success: false,
          message: 'Specified category does not exist.',
        });
        return;
      }
      medicine.category = category;
    }

    if (medicineCode && medicineCode.toUpperCase().trim() !== medicine.medicineCode) {
      const codeMatch = await Medicine.findOne({
        medicineCode: medicineCode.toUpperCase().trim(),
        _id: { $ne: medicine._id },
      });
      if (codeMatch) {
        res.status(409).json({
          success: false,
          message: `Medicine code '${medicineCode}' is already registered to another item.`,
        });
        return;
      }
      medicine.medicineCode = medicineCode.toUpperCase().trim();
    }

    if (sku && sku.toUpperCase().trim() !== medicine.sku) {
      const skuMatch = await Medicine.findOne({
        sku: sku.toUpperCase().trim(),
        _id: { $ne: medicine._id },
      });
      if (skuMatch) {
        res.status(409).json({
          success: false,
          message: `SKU '${sku}' is already registered to another item.`,
        });
        return;
      }
      medicine.sku = sku.toUpperCase().trim();
    }

    if (barcode !== undefined) {
      if (barcode && barcode.trim() !== medicine.barcode) {
        const barcodeMatch = await Medicine.findOne({
          barcode: barcode.trim(),
          _id: { $ne: medicine._id },
        });
        if (barcodeMatch) {
          res.status(409).json({
            success: false,
            message: `Barcode '${barcode}' is already assigned to another item.`,
          });
          return;
        }
      }
      medicine.barcode = barcode ? barcode.trim() : undefined;
    }

    if (name) medicine.name = name;
    if (genericName) medicine.genericName = genericName;
    if (brandName) medicine.brandName = brandName;
    if (manufacturer) medicine.manufacturer = manufacturer;
    if (description !== undefined) medicine.description = description;
    if (dosageForm) medicine.dosageForm = dosageForm;
    if (strength) medicine.strength = strength;
    if (unitOfMeasurement) medicine.unitOfMeasurement = unitOfMeasurement;
    if (reorderThreshold !== undefined) medicine.reorderThreshold = reorderThreshold;
    if (isActive !== undefined) medicine.isActive = isActive;

    await medicine.save();

    await AuditLog.create({
      action: AuditAction.UPDATE,
      entity: AuditEntity.MEDICINE,
      entityId: medicine._id.toString(),
      performedBy: req.user?._id,
      details: { updatedFields: req.body },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: medicine,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMedicine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
      return;
    }

    // Check if medicine has active or historical batches
    const batchesCount = await Batch.countDocuments({ medicine: medicine._id });

    if (batchesCount > 0) {
      // Safe deactivation to preserve regulatory audit trail and historical inventory records
      medicine.isActive = false;
      await medicine.save();

      await AuditLog.create({
        action: AuditAction.STATUS_CHANGE,
        entity: AuditEntity.MEDICINE,
        entityId: medicine._id.toString(),
        performedBy: req.user?._id,
        details: { message: `Medicine deactivated. It has ${batchesCount} historical batch record(s).` },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: `Medicine '${medicine.name}' has ${batchesCount} historical batch record(s) and was safely deactivated rather than deleted.`,
        data: medicine,
      });
      return;
    }

    await Medicine.findByIdAndDelete(medicine._id);

    await AuditLog.create({
      action: AuditAction.DELETE,
      entity: AuditEntity.MEDICINE,
      entityId: medicine._id.toString(),
      performedBy: req.user?._id,
      details: { deletedMedicine: medicine.name, sku: medicine.sku },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: `Medicine '${medicine.name}' deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

export const getLowStockMedicines = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();

    // Find all active medicines with their active available stock
    const medicines = await Medicine.find({ isActive: true }).populate('category', 'name slug');

    const stockAggregates = await Batch.aggregate([
      { $match: { expiryDate: { $gt: today }, availableQuantity: { $gt: 0 } } },
      { $group: { _id: '$medicine', totalAvailableStock: { $sum: '$availableQuantity' } } },
    ]);

    const stockMap = new Map(stockAggregates.map((s) => [s._id.toString(), s.totalAvailableStock]));

    const lowStockMedicines = medicines
      .map((m) => {
        const availableStock = stockMap.get(m._id.toString()) || 0;
        return {
          ...m.toObject(),
          totalAvailableStock: availableStock,
          reorderDeficit: Math.max(0, m.reorderThreshold - availableStock),
        };
      })
      .filter((m) => m.totalAvailableStock <= m.reorderThreshold);

    res.status(200).json({
      success: true,
      count: lowStockMedicines.length,
      data: lowStockMedicines,
    });
  } catch (error) {
    next(error);
  }
};
