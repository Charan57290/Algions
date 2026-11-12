import { Request, Response, NextFunction } from 'express';
import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { Supplier } from '../models/Supplier.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';
import { previewFefoAllocation } from '../services/fefo.service.js';
import { calculateInventoryValuation, getNearExpiryBatches } from '../services/inventory.service.js';

export const getAllBatches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.medicine) {
      query.medicine = req.query.medicine;
    }

    if (req.query.supplier) {
      query.supplier = req.query.supplier;
    }

    const now = new Date();

    if (req.query.status === 'expired') {
      query.expiryDate = { $lte: now };
    } else if (req.query.status === 'active') {
      query.expiryDate = { $gt: now };
      query.availableQuantity = { $gt: 0 };
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.batchNumber = searchRegex;
    }

    const [batches, total] = await Promise.all([
      Batch.find(query)
        .populate('medicine', 'name genericName medicineCode sku strength unitOfMeasurement')
        .populate('supplier', 'name supplierCode phone')
        .sort({ expiryDate: 1 })
        .skip(skip)
        .limit(limit),
      Batch.countDocuments(query),
    ]);

    const enriched = batches.map((b) => ({
      ...b.toObject(),
      isExpired: new Date(b.expiryDate) <= now,
    }));

    res.status(200).json({
      success: true,
      data: enriched,
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

export const getBatchById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('medicine')
      .populate('supplier');

    if (!batch) {
      res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
      return;
    }

    const now = new Date();
    res.status(200).json({
      success: true,
      data: {
        ...batch.toObject(),
        isExpired: new Date(batch.expiryDate) <= now,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createManualBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      medicine,
      batchNumber,
      supplier,
      manufacturingDate,
      expiryDate,
      purchasePrice,
      sellingPrice,
      initialQuantity,
      availableQuantity,
    } = req.body;

    const [medExists, supExists] = await Promise.all([
      Medicine.findById(medicine),
      Supplier.findById(supplier),
    ]);

    if (!medExists) {
      res.status(400).json({ success: false, message: 'Medicine does not exist.' });
      return;
    }

    if (!supExists) {
      res.status(400).json({ success: false, message: 'Supplier does not exist.' });
      return;
    }

    const mfg = new Date(manufacturingDate);
    const exp = new Date(expiryDate);
    if (exp <= mfg) {
      res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date.' });
      return;
    }

    const existingBatch = await Batch.findOne({
      medicine,
      batchNumber: batchNumber.toUpperCase().trim(),
    });

    if (existingBatch) {
      res.status(409).json({
        success: false,
        message: `Batch '${batchNumber}' is already registered for this medicine.`,
      });
      return;
    }

    const availQty = availableQuantity !== undefined ? availableQuantity : initialQuantity;

    const batch = await Batch.create({
      medicine,
      batchNumber: batchNumber.toUpperCase().trim(),
      supplier,
      manufacturingDate: mfg,
      expiryDate: exp,
      purchasePrice,
      sellingPrice,
      initialQuantity,
      availableQuantity: availQty,
    });

    // Record opening stock movement
    await StockMovement.create({
      medicine,
      batch: batch._id,
      movementType: MovementType.OPENING_STOCK,
      quantityAdded: availQty,
      quantityRemoved: 0,
      previousBalance: 0,
      newBalance: availQty,
      reason: 'Manual batch creation opening balance',
      user: req.user?._id,
    });

    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.BATCH,
      entityId: batch._id.toString(),
      performedBy: req.user?._id,
      details: { batchNumber: batch.batchNumber, medicine: medExists.name, quantity: availQty },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Batch registered successfully with opening stock movement',
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

export const getFefoPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const medicineId = req.query.medicine as string;
    const quantity = parseInt(req.query.quantity as string, 10);

    const preview = await previewFefoAllocation(medicineId, quantity);

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error computing FEFO preview',
    });
  }
};

export const getValuationReport = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const valuation = await calculateInventoryValuation();
    res.status(200).json({
      success: true,
      data: valuation,
    });
  } catch (error) {
    next(error);
  }
};

export const getNearExpiryAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const batches = await getNearExpiryBatches(days);

    res.status(200).json({
      success: true,
      count: batches.length,
      alertThresholdDays: days,
      data: batches,
    });
  } catch (error) {
    next(error);
  }
};
