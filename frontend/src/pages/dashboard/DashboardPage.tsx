import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  ArrowRight,
  ShieldAlert,
  FileText,
  Pill,
} from 'lucide-react';
import { reportApi, saleApi, masterDataApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { DashboardKPIs, InvoicePayload, Medicine } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { InvoiceModal } from '../../components/common/InvoiceModal';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user, isCustomer } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [featuredMeds, setFeaturedMeds] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePayload | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isCustomer) {
      const fetchCustomerData = async () => {
        try {
          const res = await masterDataApi.getMedicines({ limit: 6, isActive: true });
          setFeaturedMeds(Array.isArray(res) ? res : (res?.medicines || []));
        } catch (err) {
          console.error('Failed to load medicine catalogue for customer:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCustomerData();
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const data = await reportApi.getDashboardKPIs();
        setKpis(data);
      } catch (err) {
        console.error('Failed to load dashboard KPIs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [isCustomer]);

  const handleViewInvoice = async (saleId: string) => {
    try {
      const invoice = await saleApi.getInvoice(saleId);
      setSelectedInvoice(invoice);
      setIsInvoiceOpen(true);
    } catch (err) {
      console.error('Failed to fetch invoice:', err);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Calculating real-time pharmacy analytics..." />;
  }

  if (isCustomer) {
    return (
      <div className="space-y-6">
        {/* Customer Welcome Hero */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 rounded-3xl p-8 text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide text-emerald-100 uppercase">
              Customer Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
              Welcome, {user?.name || 'Valued Customer'}!
            </h1>
            <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
              Explore available pharmaceutical inventory, check medicine batch availability, and find essential health supplies in real-time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/medicines"
                className="px-5 py-2.5 bg-white text-emerald-900 font-bold rounded-xl text-xs hover:bg-emerald-50 transition shadow-sm flex items-center gap-2"
              >
                <Pill className="w-4 h-4 text-emerald-700" />
                Browse Medicine Catalogue
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold mb-3">
              <Pill className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Genuine & Verified Stock</h3>
            <p className="text-xs text-slate-500 mt-1">
              Every pharmaceutical SKU is tracked with discrete batch numbers, manufacturing seals, and strict expiry dates.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">24/7 Store Pharmacy</h3>
            <p className="text-xs text-slate-500 mt-1">
              In-store pharmacists are available round-the-clock for prescription verification and drug consultations.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 font-bold mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Regulated Dispensing</h3>
            <p className="text-xs text-slate-500 mt-1">
              Prescription-only drugs require an authorized medical doctor prescription upon in-store pickup.
            </p>
          </div>
        </div>

        {/* Featured Medicines Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Available Medicines Catalogue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Popular medicines currently stocked in the pharmacy
              </p>
            </div>
            <Link
              to="/medicines"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View Full Catalogue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {featuredMeds.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Loading available medicines...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featuredMeds.map((med) => (
                <div
                  key={med._id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition bg-slate-50/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                    <Badge variant={(med.totalAvailableStock || 0) > 0 ? 'success' : 'neutral'} size="sm">
                      {(med.totalAvailableStock || 0) > 0 ? `${med.totalAvailableStock} in stock` : 'Out of stock'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{med.genericName}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium text-[11px]">
                      {med.dosageForm} • {med.strength}
                    </span>
                    <span className="font-bold text-emerald-700 text-xs">
                      {med.brandName || 'Generic'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl">
        Failed to load analytical dashboard metrics. Please ensure backend server is running.
      </div>
    );
  }

  const expiringBatches = kpis.expiringBatches || [];
  const lowStockMedicines = kpis.lowStockMedicines || [];
  const sevenDayTrend = kpis.sevenDayTrend || [];
  const recentSales = kpis.recentSales || [];
  const inventory = kpis.inventory || {
    totalBatches: 0,
    totalMedicines: (kpis as any).kpis?.totalMedicines || 0,
    lowStockCount: (kpis as any).kpis?.lowStockMedicinesCount || 0,
    expiringWithin30DaysCount: (kpis as any).kpis?.nearExpiryBatchesCount || 0,
    expiredBatchesCount: 0,
  };
  const valuation = kpis.valuation || {
    totalPurchaseValuation: (kpis as any).kpis?.totalInventoryCost || 0,
    totalRetailValuation: (kpis as any).kpis?.totalRetailValue || 0,
    potentialGrossMargin: 0,
    expiredValuationLoss: 0,
  };
  const salesPerformance = kpis.salesPerformance || {
    salesCount: (kpis as any).kpis?.todayOrders || 0,
    grossSalesRevenue: (kpis as any).kpis?.todayRevenue || 0,
    netSalesRevenue: (kpis as any).kpis?.todayRevenue || 0,
    totalCogs: 0,
    grossProfit: 0,
    profitMarginPercent: 0,
    totalUnitsSold: 0,
  };

  return (
    <div className="space-y-8">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pharmacy Operations Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time batch-level inventory metrics, FEFO allocation health, and fiscal overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/pos"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
          >
            <ShoppingCart className="w-4 h-4" />
            Launch POS Checkout
          </Link>
          <Link
            to="/inventory"
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            View Batches
          </Link>
        </div>
      </div>

      {/* Critical Expiry / Low-Stock Alerts Banner */}
      {(expiringBatches.length > 0 || lowStockMedicines.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiringBatches.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-amber-900">
                  {expiringBatches.length} Batch(es) Expiring Within 30 Days
                </h4>
                <p className="text-amber-800 mt-0.5">
                  Action required: Review inventory rotation or prepare returns to suppliers.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {expiringBatches.slice(0, 3).map((b) => (
                    <span
                      key={b._id}
                      className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[10px] rounded-md font-bold"
                    >
                      {b.batchNumber} (Exp: {new Date(b.expiryDate).toLocaleDateString()})
                    </span>
                  ))}
                  {expiringBatches.length > 3 && (
                    <Link to="/reports" className="text-amber-900 underline font-semibold ml-1 self-center">
                      +{expiringBatches.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {lowStockMedicines.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-rose-900">
                  {lowStockMedicines.length} Medicine(s) Below Reorder Threshold
                </h4>
                <p className="text-rose-800 mt-0.5">
                  Sellable stock is critically depleted. Create purchase orders to replenish stock.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lowStockMedicines.slice(0, 3).map((m) => (
                    <span
                      key={m._id}
                      className="inline-block px-2 py-0.5 bg-rose-100 text-rose-900 font-mono text-[10px] rounded-md font-bold"
                    >
                      {m.name} ({m.totalAvailableStock || 0} units left)
                    </span>
                  ))}
                  <Link to="/purchases" className="text-rose-900 underline font-semibold ml-1 self-center">
                    Inward Stock →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Net Revenue (Past 30D)"
          value={`₹${(salesPerformance.netSalesRevenue || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
          })}`}
          subtitle={`${salesPerformance.salesCount} orders completed`}
          icon={DollarSign}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />

        <StatCard
          title="Gross Profit Margin"
          value={`${(salesPerformance.profitMarginPercent || 0).toFixed(1)}%`}
          subtitle={`₹${(salesPerformance.grossProfit || 0).toLocaleString('en-IN')} gross profit`}
          icon={TrendingUp}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />

        <StatCard
          title="Stock Valuation"
          value={`₹${(valuation.totalRetailValuation || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 0,
          })}`}
          subtitle={`Cost: ₹${(valuation.totalPurchaseValuation || 0).toLocaleString('en-IN')}`}
          icon={Boxes}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />

        <StatCard
          title="Stock Alerts"
          value={inventory.lowStockCount + inventory.expiringWithin30DaysCount}
          subtitle={`${inventory.lowStockCount} low stock • ${inventory.expiringWithin30DaysCount} near-expiry`}
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
        />
      </div>

      {/* Revenue & Margin Velocity Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              7-Day Sales & Profit Margin Velocity
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Net revenue vs Cost of Goods Sold (COGS)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Margin
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sevenDayTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, '']}
                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Net Revenue"
              />
              <Area
                type="monotone"
                dataKey="margin"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMargin)"
                name="Gross Margin"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Sales & Invoices
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time point of sale transactions and payment settlement status
            </p>
          </div>
          <Link
            to="/reports"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Full Sales Report <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                <th className="py-3 px-6">Invoice #</th>
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Items</th>
                <th className="py-3 px-6">Payment</th>
                <th className="py-3 px-6 text-right">Amount</th>
                <th className="py-3 px-6 text-center">Status</th>
                <th className="py-3 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transactions recorded yet. Complete your first checkout in POS Billing.
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-slate-900">{sale.customerName || 'Walk-in'}</p>
                      {sale.customerPhone && <p className="text-[11px] text-slate-400">{sale.customerPhone}</p>}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {sale.items.length} product(s)
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="font-medium text-slate-700">{sale.paymentMethod}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900">
                      ₹{sale.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <Badge
                        variant={
                          sale.status === 'COMPLETED'
                            ? 'success'
                            : sale.status === 'REFUNDED'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {sale.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <button
                        onClick={() => handleViewInvoice(sale._id)}
                        className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg font-medium inline-flex items-center gap-1 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
};
