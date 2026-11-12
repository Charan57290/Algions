import { Request, Response, NextFunction } from 'express';
import { Return } from '../models/Return.js';
import { processCustomerReturnTransaction } from '../services/return.service.js';

export const createReturn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const returnDoc = await processCustomerReturnTransaction(req.body, req.user);

    res.status(201).json({
      success: true,
      message: 'Customer return processed, stock movements recorded, and sale status updated.',
      data: returnDoc,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing return transaction',
    });
  }
};

export const getAllReturns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { returnNumber: searchRegex },
        { invoiceNumber: searchRegex },
        { 'customer.name': searchRegex },
        { overallReason: searchRegex },
      ];
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

    const [returns, total, [aggregates]] = await Promise.all([
      Return.find(query)
        .populate('sale', 'invoiceNumber grandTotal paymentMethod')
        .populate('processedBy', 'name email role')
        .populate('items.medicine', 'name genericName medicineCode sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Return.countDocuments(query),
      Return.aggregate([
        { $match: query },
        { $group: { _id: null, totalRefundAmount: { $sum: '$totalRefundAmount' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: returns,
      summary: {
        totalRefundAmount: aggregates?.totalRefundAmount || 0,
      },
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

export const getReturnById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const returnDoc = await Return.findById(req.params.id)
      .populate('sale')
      .populate('processedBy', 'name email role')
      .populate('items.medicine')
      .populate('items.batch');

    if (!returnDoc) {
      res.status(404).json({
        success: false,
        message: 'Return transaction not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: returnDoc,
    });
  } catch (error) {
    next(error);
  }
};
