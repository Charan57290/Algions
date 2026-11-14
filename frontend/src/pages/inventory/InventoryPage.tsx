import React, { useState, useEffect } from 'react';
import {
  Boxes,
  AlertTriangle,
  History,
  DollarSign,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { inventoryApi } from '../../services/api';
import type { Batch, StockMovement } from '../../types';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'movements'>('batches');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [valuation, setValuation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [batchSearch, setBatchSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, valuationRes, movementsRes] = await Promise.all([
        inventoryApi.getBatches({
          search: batchSearch || undefined,
          status: statusFilter || undefined,
          limit: 100,
        }),
        inventoryApi.getInventoryValuation(),
        inventoryApi.getStockMovements({ limit: 50 }),
      ]);
      setBatches(Array.isArray(batchesRes) ? batchesRes : (batchesRes?.batches || []));
      setValuation(valuationRes);
      setMovements(Array.isArray(movementsRes) ? movementsRes : ((movementsRes as any)?.movements || []));
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [batchSearch, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Discrete Batch Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track discrete medicine lots, manufacturing dates, FEFO expiry timelines, and audit movements.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'batches'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 inline mr-1" />
            Active Batches ({(batches || []).length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'movements'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 inline mr-1" />
            Stock Ledger ({movements.length})
          </button>
        </div>
      </div>

      {/* Valuation Summary Cards */}
      {valuation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cost Valuation"
            value={`₹${(valuation.totalCostValuation || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}`}
            subtitle={`${valuation.totalAvailableUnits} total units in stock`}
            icon={Boxes}
            iconBgColor="bg-slate-100"
            iconTextColor="text-slate-700"
          />

          <StatCard
            title="Retail Value Potential"
            value={`₹${(valuation.totalRetailValuation || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}`}
            subtitle={`Projected Margin: ₹${(valuation.potentialGrossProfit || 0).toLocaleString('en-IN')}`}
            icon={DollarSign}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-600"
          />

          <StatCard
            title="Total Active Batches"
            value={valuation.totalBatchesCount || 0}
            subtitle="Independently tracked lots"
            icon={CheckCircle2}
            iconBgColor="bg-blue-50"
            iconTextColor="text-blue-600"
          />

          <StatCard
            title="Expired Loss Value"
            value={`₹${(valuation.expiredValuationLoss || 0).toLocaleString('en-IN')}`}
            subtitle={`${valuation.expiredBatchesCount} expired lot(s) quarantined`}
            icon={AlertTriangle}
            iconBgColor="bg-rose-50"
            iconTextColor="text-rose-600"
          />
        </div>
      )}

      {/* TAB 1: Discrete Batches */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                placeholder="Search by batch number or medicine name..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-700 focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active & Sellable</option>
              <option value="NEAR_EXPIRY">Expiring Soon (≤30 Days)</option>
              <option value="EXPIRED">Expired (Quarantined)</option>
              <option value="DEPLETED">Depleted (0 Stock)</option>
            </select>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {loading ? (
              <LoadingSpinner message="Querying discrete batch records..." />
            ) : batches.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No batches found matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-5">Batch No</th>
                      <th className="py-3 px-5">Medicine</th>
                      <th className="py-3 px-5">Supplier</th>
                      <th className="py-3 px-5">Mfg Date</th>
                      <th className="py-3 px-5">Expiry Date</th>
                      <th className="py-3 px-5 text-right">Cost (₹)</th>
                      <th className="py-3 px-5 text-right">Price (₹)</th>
                      <th className="py-3 px-5 text-center">Available / Initial</th>
                      <th className="py-3 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((batch) => {
                      const medName =
                        typeof batch.medicine === 'object' ? batch.medicine.name : 'Unknown Medicine';
                      const suppName =
                        typeof batch.supplier === 'object' ? batch.supplier.name : 'Direct Supplier';
                      const expiry = new Date(batch.expiryDate);
                      const now = new Date();
                      const daysLeft = Math.ceil(
                        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isExpired = daysLeft <= 0;
                      const isNear = daysLeft > 0 && daysLeft <= 30;

                      return (
                        <tr key={batch._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                            {batch.batchNumber}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900">{medName}</span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-600">{suppName}</td>
                          <td className="py-3.5 px-5 text-slate-500 font-mono">
                            {new Date(batch.manufacturingDate).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 font-mono">
                            <span className={isExpired ? 'text-rose-600 font-bold' : isNear ? 'text-amber-600 font-bold' : 'text-slate-800'}>
                              {expiry.toLocaleDateString()}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {isExpired ? 'Expired' : `${daysLeft} days left`}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono text-slate-600">
                            ₹{batch.purchasePrice.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{batch.sellingPrice.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-5 text-center font-mono">
                            <span className="font-bold text-slate-900">{batch.availableQuantity}</span>
                            <span className="text-slate-400"> / {batch.initialQuantity}</span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <Badge
                              variant={
                                isExpired
                                  ? 'danger'
                                  : isNear
                                  ? 'warning'
                                  : batch.availableQuantity === 0
                                  ? 'neutral'
                                  : 'success'
                              }
                              size="sm"
                            >
                              {isExpired
                                ? 'EXPIRED'
                                : isNear
                                ? 'NEAR EXPIRY'
                                : batch.availableQuantity === 0
                                ? 'DEPLETED'
                                : 'ACTIVE'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Stock Movement Ledger */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Immutable Stock Movement Ledger
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Double-entry audit trail tracking every unit increment, FEFO decrement, return, and adjustment.
              </p>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Retrieving movement audit trail..." />
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">Movement Type</th>
                    <th className="py-3 px-5">Medicine & Batch</th>
                    <th className="py-3 px-5 text-center">Previous</th>
                    <th className="py-3 px-5 text-center">Change</th>
                    <th className="py-3 px-5 text-center">New Balance</th>
                    <th className="py-3 px-5">Reason / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => {
                    const medName =
                      typeof m.medicine === 'object' ? m.medicine.name : 'Medicine';
                    const batchNum =
                      typeof m.batch === 'object' ? m.batch.batchNumber : 'Batch';
                    const isAddition = m.quantityAdded > 0;

                    return (
                      <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-slate-500">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              m.movementType.includes('SALE')
                                ? 'bg-blue-100 text-blue-800'
                                : m.movementType.includes('PURCHASE')
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.movementType.includes('RETURN')
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900">{medName}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Batch: {batchNum}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono text-slate-600">
                          {m.previousBalance}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold">
                          {isAddition ? (
                            <span className="text-emerald-600">+{m.quantityAdded}</span>
                          ) : (
                            <span className="text-rose-600">-{m.quantityRemoved}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-slate-900">
                          {m.newBalance}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">
                          {m.reason || (m.referenceType ? `${m.referenceType} Ref` : 'System Operation')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
