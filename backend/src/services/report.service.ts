import { Medicine } from '../models/Medicine.js';
import { Supplier } from '../models/Supplier.js';
import { Batch } from '../models/Batch.js';
import { Sale, SaleStatus } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Return } from '../models/Return.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';

export const getDashboardSummaryMetrics = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalMedicines,
    totalSuppliers,
    todaySalesAgg,
    monthSalesAgg,
    inventoryAgg,
    nearExpiryCount,
    recentSales,
    recentPurchases,
    expiringBatches,
    totalBatchesCount,
    expiredBatchesCount,
  ] = await Promise.all([
    Medicine.countDocuments({ isActive: true }),
    Supplier.countDocuments(),
    // Today's sales
    Sale.aggregate([
      { $match: { createdAt: { $gte: startOfToday }, status: { $ne: SaleStatus.CANCELLED } } },
      { $group: { _id: null, revenue: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    // Month's sales
    Sale.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, status: { $ne: SaleStatus.CANCELLED } } },
      { $group: { _id: null, revenue: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    // Inventory units & low-stock check
    Batch.aggregate([
      { $match: { expiryDate: { $gt: now }, availableQuantity: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalAvailableUnits: { $sum: '$availableQuantity' },
          totalInventoryCost: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
          totalRetailValue: { $sum: { $multiply: ['$availableQuantity', '$sellingPrice'] } },
        },
      },
    ]),
    // Batches expiring within 30 days
    Batch.countDocuments({
      expiryDate: { $gt: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      availableQuantity: { $gt: 0 },
    }),
    // 5 Most recent sales
    Sale.find().sort({ createdAt: -1 }).limit(5).populate('cashier', 'name email'),
    // 5 Most recent purchases
    Purchase.find().sort({ purchaseDate: -1 }).limit(5).populate('supplier', 'name supplierCode'),
    // Batches expiring in next 30 days with medicine details
    Batch.find({
      expiryDate: { $gt: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      availableQuantity: { $gt: 0 },
    }).populate('medicine', 'name strength dosageForm'),
    // Total batches count
    Batch.countDocuments(),
    // Expired batches with available stock
    Batch.countDocuments({ expiryDate: { $lte: now }, availableQuantity: { $gt: 0 } }),
  ]);

  // Low stock medicines with detailed objects
  const allMedicines = await Medicine.find({ isActive: true });
  const batchStockByMed = await Batch.aggregate([
    { $match: { expiryDate: { $gt: now }, availableQuantity: { $gt: 0 } } },
    { $group: { _id: '$medicine', stock: { $sum: '$availableQuantity' } } },
  ]);
  const stockMap = new Map(batchStockByMed.map((b) => [b._id.toString(), b.stock]));
  const lowStockCount = allMedicines.filter((m) => (stockMap.get(m._id.toString()) || 0) <= m.reorderThreshold).length;
  const lowStockMedicines = allMedicines
    .filter((m) => (stockMap.get(m._id.toString()) || 0) <= m.reorderThreshold)
    .map((m) => ({
      ...m.toObject(),
      totalAvailableStock: stockMap.get(m._id.toString()) || 0,
    }));

  // 7-Day sales trend for chart
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const salesTrend = await Sale.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $ne: SaleStatus.CANCELLED } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$grandTotal' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trendMap = new Map(salesTrend.map((t) => [t._id, t]));
  const sevenDayTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const item = trendMap.get(dateStr);
    sevenDayTrend.push({
      date: dateStr,
      revenue: item?.revenue || 0,
      cogs: 0,
      margin: item?.revenue || 0,
      orderCount: item?.transactions || 0,
    });
  }

  const totalPurchaseVal = inventoryAgg[0]?.totalInventoryCost || 0;
  const totalRetailVal = inventoryAgg[0]?.totalRetailValue || 0;
  const valuation = {
    totalPurchaseValuation: Math.round(totalPurchaseVal * 100) / 100,
    totalRetailValuation: Math.round(totalRetailVal * 100) / 100,
    potentialGrossMargin: Math.round((totalRetailVal - totalPurchaseVal) * 100) / 100,
    expiredValuationLoss: 0,
  };

  const inventory = {
    totalBatches: totalBatchesCount,
    totalMedicines,
    lowStockCount,
    expiringWithin30DaysCount: nearExpiryCount,
    expiredBatchesCount,
  };

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pastMonthSales = await Sale.find({ createdAt: { $gte: thirtyDaysAgo }, status: { $ne: SaleStatus.CANCELLED } });
  const salesCount = pastMonthSales.length;
  const netSalesRevenue = pastMonthSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
  const grossSalesRevenue = pastMonthSales.reduce((acc, s) => acc + (s.subtotal || 0), 0);
  const totalCogs = pastMonthSales.reduce((acc, s) => {
    return acc + (s.items || []).reduce((iAcc, item) => iAcc + (item.purchasePriceSnapshot || 0) * (item.quantity || 0), 0);
  }, 0);
  const grossProfit = Math.max(0, netSalesRevenue - totalCogs);
  const profitMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;
  const totalUnitsSold = pastMonthSales.reduce((acc, s) => {
    return acc + (s.items || []).reduce((iAcc, item) => iAcc + (item.quantity || 0), 0);
  }, 0);

  const salesPerformance = {
    salesCount,
    grossSalesRevenue: Math.round(grossSalesRevenue * 100) / 100,
    netSalesRevenue: Math.round(netSalesRevenue * 100) / 100,
    totalCogs: Math.round(totalCogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
    totalUnitsSold,
  };

  return {
    kpis: {
      totalMedicines,
      totalSuppliers,
      totalAvailableUnits: inventoryAgg[0]?.totalAvailableUnits || 0,
      totalInventoryCost: Math.round((inventoryAgg[0]?.totalInventoryCost || 0) * 100) / 100,
      totalRetailValue: Math.round((inventoryAgg[0]?.totalRetailValue || 0) * 100) / 100,
      todayRevenue: Math.round((todaySalesAgg[0]?.revenue || 0) * 100) / 100,
      todayOrders: todaySalesAgg[0]?.count || 0,
      monthRevenue: Math.round((monthSalesAgg[0]?.revenue || 0) * 100) / 100,
      monthOrders: monthSalesAgg[0]?.count || 0,
      lowStockMedicinesCount: lowStockCount,
      nearExpiryBatchesCount: nearExpiryCount,
    },
    salesTrend,
    recentSales,
    recentPurchases,
    inventory,
    valuation,
    salesPerformance,
    sevenDayTrend,
    expiringBatches,
    lowStockMedicines,
  };
};

export const getDetailedSalesReport = async (startDate?: Date, endDate?: Date) => {
  const match: Record<string, unknown> = {
    status: { $ne: SaleStatus.CANCELLED },
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) (match.createdAt as Record<string, unknown>).$gte = startDate;
    if (endDate) (match.createdAt as Record<string, unknown>).$lte = endDate;
  }

  const sales = await Sale.find(match).sort({ createdAt: -1 });

  let grossRevenue = 0;
  let totalDiscounts = 0;
  let totalTax = 0;
  let totalCostOfGoodsSold = 0;
  const paymentBreakdown: Record<string, { count: number; total: number }> = {};
  const medicinePopularityMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();

  for (const s of sales) {
    grossRevenue += s.subtotal;
    totalDiscounts += s.totalDiscount;
    totalTax += s.taxAmount;

    // Payment breakdown
    if (!paymentBreakdown[s.paymentMethod]) {
      paymentBreakdown[s.paymentMethod] = { count: 0, total: 0 };
    }
    paymentBreakdown[s.paymentMethod].count += 1;
    paymentBreakdown[s.paymentMethod].total += s.grandTotal;

    // Line items margin & popularity
    for (const item of s.items) {
      totalCostOfGoodsSold += item.purchasePriceSnapshot * item.quantity;

      const medKey = item.medicine.toString();
      const existing = medicinePopularityMap.get(medKey) || {
        name: item.medicineName,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenue += item.total;
      medicinePopularityMap.set(medKey, existing);
    }
  }

  const netRevenue = grossRevenue - totalDiscounts + totalTax;
  const grossProfit = grossRevenue - totalDiscounts - totalCostOfGoodsSold;
  const grossMarginPercent = netRevenue > 0 ? (grossProfit / (grossRevenue - totalDiscounts)) * 100 : 0;

  const topSellingMedicines = Array.from(medicinePopularityMap.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10);

  return {
    period: {
      startDate: startDate || 'All Time',
      endDate: endDate || 'All Time',
    },
    metrics: {
      transactionCount: sales.length,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      costOfGoodsSold: Math.round(totalCostOfGoodsSold * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
    },
    paymentBreakdown,
    topSellingMedicines,
  };
};

export const getExpiryRiskReport = async () => {
  const now = new Date();
  const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const batches = await Batch.find({ availableQuantity: { $gt: 0 } })
    .populate('medicine', 'name genericName medicineCode sku strength unitOfMeasurement')
    .populate('supplier', 'name supplierCode phone')
    .sort({ expiryDate: 1 });

  const expired = [];
  const critical7Days = [];
  const high30Days = [];
  const moderate90Days = [];
  const healthy = [];

  for (const b of batches) {
    const exp = new Date(b.expiryDate);
    const item = {
      ...b.toObject(),
      lossOrCostValue: Math.round(b.availableQuantity * b.purchasePrice * 100) / 100,
      potentialRetailValue: Math.round(b.availableQuantity * b.sellingPrice * 100) / 100,
    };

    if (exp <= now) {
      expired.push(item);
    } else if (exp <= day7) {
      critical7Days.push(item);
    } else if (exp <= day30) {
      high30Days.push(item);
    } else if (exp <= day90) {
      moderate90Days.push(item);
    } else {
      healthy.push(item);
    }
  }

  const sumCost = (arr: any[]) => arr.reduce((acc, curr) => acc + curr.lossOrCostValue, 0);

  return {
    summary: {
      expiredCount: expired.length,
      expiredTotalCost: Math.round(sumCost(expired) * 100) / 100,
      critical7DaysCount: critical7Days.length,
      critical7DaysTotalCost: Math.round(sumCost(critical7Days) * 100) / 100,
      high30DaysCount: high30Days.length,
      high30DaysTotalCost: Math.round(sumCost(high30Days) * 100) / 100,
      moderate90DaysCount: moderate90Days.length,
      healthyCount: healthy.length,
    },
    tiers: {
      expired,
      critical7Days,
      high30Days,
      moderate90Days,
      healthy,
    },
  };
};

export const getReconciliationReport = async (batchId?: string) => {
  const query = batchId ? { _id: batchId } : {};
  const batches = await Batch.find(query)
    .populate('medicine', 'name medicineCode sku')
    .sort({ createdAt: -1 });

  const reconciliationResults = [];
  let totalDiscrepancies = 0;

  for (const batch of batches) {
    const movements = await StockMovement.find({ batch: batch._id }).sort({ createdAt: 1 });

    let calculatedStock = 0;
    const movementSummary = {
      openingStock: 0,
      purchased: 0,
      sold: 0,
      returnedRestocked: 0,
      adjustmentIncreased: 0,
      adjustmentDecreased: 0,
    };

    for (const m of movements) {
      switch (m.movementType) {
        case MovementType.OPENING_STOCK:
          movementSummary.openingStock += m.quantityAdded;
          calculatedStock += m.quantityAdded;
          break;
        case MovementType.PURCHASE_RECEIVED:
          movementSummary.purchased += m.quantityAdded;
          calculatedStock += m.quantityAdded;
          break;
        case MovementType.SALE:
          movementSummary.sold += m.quantityRemoved;
          calculatedStock -= m.quantityRemoved;
          break;
        case MovementType.CUSTOMER_RETURN:
          movementSummary.returnedRestocked += m.quantityAdded;
          calculatedStock += m.quantityAdded;
          break;
        case MovementType.STOCK_ADJUSTMENT:
          if (m.quantityAdded > 0) {
            movementSummary.adjustmentIncreased += m.quantityAdded;
            calculatedStock += m.quantityAdded;
          }
          if (m.quantityRemoved > 0) {
            movementSummary.adjustmentDecreased += m.quantityRemoved;
            calculatedStock -= m.quantityRemoved;
          }
          break;
      }
    }

    const currentActual = batch.availableQuantity;
    const isReconciled = calculatedStock === currentActual;
    if (!isReconciled) totalDiscrepancies += 1;

    reconciliationResults.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      medicineName: (batch.medicine as any)?.name,
      medicineCode: (batch.medicine as any)?.medicineCode,
      currentActualStock: currentActual,
      ledgerCalculatedStock: calculatedStock,
      variance: currentActual - calculatedStock,
      isReconciled,
      movementBreakdown: movementSummary,
      totalMovementsRecorded: movements.length,
    });
  }

  return {
    reconciliationTimestamp: new Date().toISOString(),
    totalBatchesAudited: batches.length,
    totalDiscrepancies,
    reconciliationStatus: totalDiscrepancies === 0 ? 'PERFECTLY_RECONCILED' : 'DISCREPANCIES_DETECTED',
    batches: reconciliationResults,
  };
};
