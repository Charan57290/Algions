import { Request, Response, NextFunction } from 'express';
import { StockMovement, MovementType } from '../models/StockMovement.js';

export const getAllMovements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.medicine) {
      query.medicine = req.query.medicine;
    }

    if (req.query.batch) {
      query.batch = req.query.batch;
    }

    if (req.query.movementType && Object.values(MovementType).includes(req.query.movementType as MovementType)) {
      query.movementType = req.query.movementType;
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(req.query.endDate as string);
      }
    }

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .populate('medicine', 'name genericName medicineCode sku unitOfMeasurement')
        .populate('batch', 'batchNumber expiryDate sellingPrice purchasePrice')
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: movements,
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

export const getMovementsByBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const movements = await StockMovement.find({ batch: req.params.batchId })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: movements.length,
      data: movements,
    });
  } catch (error) {
    next(error);
  }
};

export const getMovementsByMedicine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const movements = await StockMovement.find({ medicine: req.params.medicineId })
      .populate('batch', 'batchNumber expiryDate')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: movements.length,
      data: movements,
    });
  } catch (error) {
    next(error);
  }
};
