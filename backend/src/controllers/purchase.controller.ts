import { Request, Response, NextFunction } from 'express';
import { Purchase, PurchasePaymentStatus } from '../models/Purchase.js';
import { receivePurchaseConsignment } from '../services/inventory.service.js';
import { AuditLog, AuditAction, AuditEntity } from '../models/AuditLog.js';

export const getAllPurchases = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (req.query.supplier) {
      query.supplier = req.query.supplier;
    }

    if (req.query.paymentStatus && Object.values(PurchasePaymentStatus).includes(req.query.paymentStatus as PurchasePaymentStatus)) {
      query.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [{ purchaseNumber: searchRegex }, { supplierInvoiceNumber: searchRegex }];
    }

    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('supplier', 'name supplierCode phone email')
        .populate('receivedBy', 'name email role')
        .populate('items.medicine', 'name genericName medicineCode sku')
        .sort({ purchaseDate: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: purchases,
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

export const getPurchaseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier')
      .populate('receivedBy', 'name email role')
      .populate('items.medicine')
      .populate('items.batch');

    if (!purchase) {
      res.status(404).json({
        success: false,
        message: 'Purchase record not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};

export const createPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const purchase = await receivePurchaseConsignment(req.body, req.user);

    await AuditLog.create({
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: purchase._id.toString(),
      performedBy: req.user._id,
      details: {
        purchaseNumber: purchase.purchaseNumber,
        supplierInvoiceNumber: purchase.supplierInvoiceNumber,
        itemCount: purchase.items.length,
        totalAmount: purchase.totalAmount,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order received, inventory stock updated, and movements recorded.',
      data: purchase,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing purchase consignment',
    });
  }
};
