import { Request, Response, NextFunction } from 'express';
import { Sale, PaymentMethod, SaleStatus } from '../models/Sale.js';
import { processSaleTransaction, generatePrintableInvoice } from '../services/sale.service.js';

export const createSale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const sale = await processSaleTransaction(req.body, req.user);

    res.status(201).json({
      success: true,
      message: 'Sale transaction processed successfully, inventory allocated via FEFO, and invoice generated.',
      data: sale,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing sales transaction',
      deficit: error.deficit || undefined,
    });
  }
};

export const getAllSales = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.status && Object.values(SaleStatus).includes(req.query.status as SaleStatus)) {
      query.status = req.query.status;
    }

    if (req.query.paymentMethod && Object.values(PaymentMethod).includes(req.query.paymentMethod as PaymentMethod)) {
      query.paymentMethod = req.query.paymentMethod;
    }

    if (req.query.cashier) {
      query.cashier = req.query.cashier;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.phone': searchRegex },
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

    const [sales, total, [aggregates]] = await Promise.all([
      Sale.find(query)
        .populate('cashier', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments(query),
      Sale.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalDiscountGiven: { $sum: '$totalDiscount' },
            totalTaxCollected: { $sum: '$taxAmount' },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: sales,
      summary: {
        totalRevenue: aggregates?.totalRevenue || 0,
        totalDiscountGiven: aggregates?.totalDiscountGiven || 0,
        totalTaxCollected: aggregates?.totalTaxCollected || 0,
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

export const getSaleById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('cashier', 'name email role')
      .populate('items.medicine', 'name genericName medicineCode sku strength unitOfMeasurement')
      .populate('items.batch', 'batchNumber expiryDate sellingPrice');

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Sale transaction not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

export const getSaleInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const invoice = await generatePrintableInvoice(req.params.id);
    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message || 'Invoice could not be generated for this transaction',
    });
  }
};
