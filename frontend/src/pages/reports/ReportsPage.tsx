import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileCheck2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { reportApi } from '../../services/api';
import type { ExpiryRiskCategory, ReconciliationReport } from '../../types';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'expiry' | 'reconciliation'>('sales');
  const [salesReport, setSalesReport] = useState<any>(null);
  const [expiryReport, setExpiryReport] = useState<ExpiryRiskCategory[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [salesRes, expiryRes, reconRes] = await Promise.all([
          reportApi.getSalesReport(),
          reportApi.getExpiryRiskReport(),
          reportApi.getReconciliationReport(),
        ]);
        setSalesReport(salesRes);
        setExpiryReport(Array.isArray(expiryRes) ? expiryRes : []);
        setReconciliation(reconRes);
      } catch (err) {
        console.error('Failed to load analytical reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Generating analytical reports and auditing ledgers..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Analytical Reports & Audit Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Financial performance, batch expiry risk tiers, and double-entry stock movement reconciliation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'sales'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 inline mr-1" />
            Sales & Margin
          </button>
          <button
            onClick={() => setActiveTab('expiry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'expiry'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Expiry Risk Matrix
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'reconciliation'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 inline mr-1" />
            Stock Reconciliation
          </button>
        </div>
      </div>

      {/* TAB 1: Sales & Margin Report */}
      {activeTab === 'sales' && salesReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Net Revenue"
              value={`₹${(salesReport.summary?.netRevenue ?? salesReport.metrics?.netRevenue ?? 0).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}`}
              subtitle={`${salesReport.summary?.totalTransactions ?? salesReport.metrics?.transactionCount ?? 0} transactions`}
              icon={DollarSign}
              iconBgColor="bg-emerald-50"
              iconTextColor="text-emerald-600"
            />
            <StatCard
              title="Cost of Goods Sold (COGS)"
              value={`₹${(salesReport.summary?.totalCogs ?? salesReport.metrics?.costOfGoodsSold ?? 0).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}`}
              subtitle="Batch purchase acquisition cost"
              icon={BarChart3}
              iconBgColor="bg-slate-100"
              iconTextColor="text-slate-700"
            />
            <StatCard
              title="Gross Profit"
              value={`₹${(salesReport.summary?.grossProfit ?? salesReport.metrics?.grossProfit ?? 0).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}`}
              subtitle="Net Revenue minus COGS"
              icon={TrendingUp}
              iconBgColor="bg-blue-50"
              iconTextColor="text-blue-600"
            />
            <StatCard
              title="Gross Margin Percentage"
              value={`${(salesReport.summary?.profitMarginPercent ?? salesReport.metrics?.grossMarginPercent ?? 0).toFixed(1)}%`}
              subtitle={`Tax Collected: ₹${(salesReport.summary?.totalTax ?? salesReport.metrics?.totalTax ?? 0).toFixed(2)}`}
              icon={CheckCircle2}
              iconBgColor="bg-purple-50"
              iconTextColor="text-purple-600"
            />
          </div>

          {/* Sales Breakdown by Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Revenue Breakdown by Payment Method
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {Object.entries(salesReport.paymentBreakdown || {}).map(([method, data]: [string, any]) => (
                <div key={method} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-700">{method}</p>
                  <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                    ₹{Number(data.amount ?? data.total ?? 0).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{data.count || 0} order(s)</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Expiry Risk Matrix */}
      {activeTab === 'expiry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {expiryReport.map((cat) => {
              const badgeVariant =
                cat.riskLevel === 'EXPIRED'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : cat.riskLevel === 'CRITICAL'
                  ? 'bg-orange-50 border-orange-200 text-orange-900'
                  : cat.riskLevel === 'HIGH'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : cat.riskLevel === 'MODERATE'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900';

              return (
                <div key={cat.riskLevel} className={`p-4 rounded-xl border ${badgeVariant}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider">{cat.title}</p>
                  <h4 className="text-2xl font-bold font-mono mt-1">{cat.count} Lots</h4>
                  <p className="text-xs font-semibold mt-1">{cat.totalUnits} Units</p>
                  <p className="text-[11px] mt-0.5">Val: ₹{cat.costValue.toLocaleString('en-IN')}</p>
                </div>
              );
            })}
          </div>

          {/* Detailed Batches Accordion / Cards per tier */}
          {expiryReport.map((cat) => (
            <div key={cat.riskLevel} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {cat.title} — {cat.description}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {cat.batches.length} batch(es) • {cat.totalUnits} total units • ₹{cat.costValue.toFixed(2)} purchase value
                  </p>
                </div>
                <Badge
                  variant={
                    cat.riskLevel === 'EXPIRED'
                      ? 'danger'
                      : cat.riskLevel === 'CRITICAL'
                      ? 'amber'
                      : cat.riskLevel === 'HIGH'
                      ? 'warning'
                      : cat.riskLevel === 'MODERATE'
                      ? 'info'
                      : 'success'
                  }
                  size="sm"
                >
                  {cat.riskLevel}
                </Badge>
              </div>

              {cat.batches.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No batches currently classified under this risk level.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-4">Batch No</th>
                        <th className="py-2.5 px-4">Medicine Name</th>
                        <th className="py-2.5 px-4">Expiry Date</th>
                        <th className="py-2.5 px-4 text-center">Available Units</th>
                        <th className="py-2.5 px-4 text-right">Cost Value (₹)</th>
                        <th className="py-2.5 px-4 text-right">Retail Potential (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cat.batches.map((b) => {
                        const medName =
                          typeof b.medicine === 'object' ? b.medicine.name : 'Medicine';
                        return (
                          <tr key={b._id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                              {b.batchNumber}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{medName}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">
                              {new Date(b.expiryDate).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-800">
                              {b.availableQuantity}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                              ₹{(b.purchasePrice * b.availableQuantity).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                              ₹{(b.sellingPrice * b.availableQuantity).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Mathematical Stock Reconciliation */}
      {activeTab === 'reconciliation' && reconciliation && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  reconciliation.summary.auditPassed
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {reconciliation.summary.auditPassed ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {reconciliation.summary.auditPassed
                    ? 'Double-Entry Audit Ledger Verified'
                    : 'Discrepancies Detected in Ledger'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified mathematical formula: Opening Balance + Purchases + Returns - Sales ± Adjustments == Current Balance
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400">Audited Batches</span>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {reconciliation.summary.totalActiveBatchesAudited}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Audit Discrepancy Findings ({reconciliation.discrepancies.length})
              </h4>
            </div>

            {reconciliation.discrepancies.length === 0 ? (
              <div className="p-8 text-center text-xs text-emerald-700 bg-emerald-50/30">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold text-sm">Perfect Stock Movement Concordance</p>
                <p className="text-slate-500 mt-1">
                  All active batches have 100% mathematical integrity across historical ledger entries.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-semibold">
                      <th className="py-3 px-5">Batch #</th>
                      <th className="py-3 px-5">Medicine</th>
                      <th className="py-3 px-5 text-center">Recorded Balance</th>
                      <th className="py-3 px-5 text-center">Movement Ledger Sum</th>
                      <th className="py-3 px-5 text-center">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconciliation.discrepancies.map((d) => (
                      <tr key={d.batchId} className="hover:bg-rose-50/50">
                        <td className="py-3 px-5 font-mono font-bold text-slate-900">
                          {d.batchNumber}
                        </td>
                        <td className="py-3 px-5">{d.medicineName}</td>
                        <td className="py-3 px-5 text-center font-mono">{d.recordedBalance}</td>
                        <td className="py-3 px-5 text-center font-mono">{d.calculatedBalance}</td>
                        <td className="py-3 px-5 text-center font-mono font-bold text-rose-600">
                          {d.discrepancy > 0 ? `+${d.discrepancy}` : d.discrepancy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
