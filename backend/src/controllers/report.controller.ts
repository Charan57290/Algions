import { Request, Response, NextFunction } from 'express';
import {
  getDashboardSummaryMetrics,
  getDetailedSalesReport,
  getExpiryRiskReport,
  getReconciliationReport,
} from '../services/report.service.js';
import { calculateInventoryValuation } from '../services/inventory.service.js';
import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';

export const getDashboardKPIs = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await getDashboardSummaryMetrics();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const report = await getDetailedSalesReport(startDate, endDate);
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryReport = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const now = new Date();
    const medicines = await Medicine.find({ isActive: true })
      .populate('category', 'name slug')
      .sort({ name: 1 });

    const batchStockByMed = await Batch.aggregate([
      {
        $group: {
          _id: '$medicine',
          totalActiveStock: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$expiryDate', now] }, { $gt: ['$availableQuantity', 0] }] }, '$availableQuantity', 0],
            },
          },
          totalExpiredStock: {
            $sum: {
              $cond: [{ $lte: ['$expiryDate', now] }, '$availableQuantity', 0],
            },
          },
          batchCount: { $sum: 1 },
        },
      },
    ]);

    const stockMap = new Map(batchStockByMed.map((b) => [b._id.toString(), b]));

    const report = medicines.map((m) => {
      const stats = stockMap.get(m._id.toString()) || {
        totalActiveStock: 0,
        totalExpiredStock: 0,
        batchCount: 0,
      };

      const isLowStock = stats.totalActiveStock <= m.reorderThreshold;

      return {
        _id: m._id,
        name: m.name,
        genericName: m.genericName,
        medicineCode: m.medicineCode,
        sku: m.sku,
        category: (m.category as any)?.name || 'Uncategorized',
        dosageForm: m.dosageForm,
        strength: m.strength,
        unitOfMeasurement: m.unitOfMeasurement,
        reorderThreshold: m.reorderThreshold,
        totalActiveStock: stats.totalActiveStock,
        totalExpiredStock: stats.totalExpiredStock,
        batchCount: stats.batchCount,
        isLowStock,
        reorderDeficit: isLowStock ? Math.max(0, m.reorderThreshold - stats.totalActiveStock) : 0,
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });
  } catch (error) {
    next(error);
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

export const getExpiryReport = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const report = await getExpiryRiskReport();
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

export const getReconciliationReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batchId = req.query.batchId as string | undefined;
    const report = await getReconciliationReport(batchId);
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};
