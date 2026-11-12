import { Request, Response, NextFunction } from 'express';
import {
  StockAdjustment,
  AdjustmentType,
  AdjustmentReason,
} from '../models/StockAdjustment.js';
import { processStockAdjustmentTransaction } from '../services/adjustment.service.js';

export const createAdjustment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const adjustment = await processStockAdjustmentTransaction(req.body, req.user);

    res.status(201).json({
      success: true,
      message: 'Stock adjustment applied, inventory quantity updated, and audit ledger recorded.',
      data: adjustment,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing stock adjustment',
    });
  }
};

export const getAllAdjustments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.adjustmentType && Object.values(AdjustmentType).includes(req.query.adjustmentType as AdjustmentType)) {
      query.adjustmentType = req.query.adjustmentType;
    }

    if (req.query.reason && Object.values(AdjustmentReason).includes(req.query.reason as AdjustmentReason)) {
      query.reason = req.query.reason;
    }

    if (req.query.batchId) {
      query.batch = req.query.batchId;
    }

    if (req.query.medicineId) {
      query.medicine = req.query.medicineId;
    }

    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('medicine', 'name genericName medicineCode sku')
        .populate('batch', 'batchNumber expiryDate availableQuantity')
        .populate('adjustedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockAdjustment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: adjustments,
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

export const getAdjustmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adjustment = await StockAdjustment.findById(req.params.id)
      .populate('medicine')
      .populate('batch')
      .populate('adjustedBy', 'name email role');

    if (!adjustment) {
      res.status(404).json({
        success: false,
        message: 'Stock adjustment record not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: adjustment,
    });
  } catch (error) {
    next(error);
  }
};
