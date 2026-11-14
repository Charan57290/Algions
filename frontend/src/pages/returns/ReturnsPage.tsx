import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  returnApi,
  adjustmentApi,
  saleApi,
  inventoryApi,
} from '../../services/api';
import type {
  ReturnRecord,
  StockAdjustment,
  Sale,
  Batch,
} from '../../types';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const ReturnsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'returns' | 'adjustments'>('returns');
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [invoiceLookup, setInvoiceLookup] = useState('');
  const [saleFound, setSaleFound] = useState<Sale | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<
    Array<{
      batchId: string;
      batchNumber: string;
      medicineName: string;
      maxReturnable: number;
      unitPrice: number;
      quantity: number;
      condition: 'UNDAMAGED' | 'DAMAGED' | 'EXPIRED';
      restock: boolean;
    }>
  >([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Adjustment Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [adjBatchId, setAdjBatchId] = useState('');
  const [adjType, setAdjType] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [adjQty, setAdjQty] = useState(1);
  const [adjReason, setAdjReason] = useState<
    'COUNT_CORRECTION' | 'DAMAGE' | 'EXPIRED_SCRAPPED' | 'THEFT' | 'BREAKAGE' | 'OTHER'
  >('DAMAGE');
  const [adjRemarks, setAdjRemarks] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [returnsRes, adjustmentsRes, batchesRes] = await Promise.all([
        returnApi.getReturns({ limit: 50 }),
        adjustmentApi.getAdjustments({ limit: 50 }),
        inventoryApi.getBatches({ limit: 100 }),
      ]);
      const returnsList = Array.isArray(returnsRes) ? returnsRes : (returnsRes?.returns || []);
      const adjList = Array.isArray(adjustmentsRes) ? adjustmentsRes : (adjustmentsRes?.adjustments || []);
      const batchesList = Array.isArray(batchesRes) ? batchesRes : (batchesRes?.batches || []);

      setReturns(returnsList);
      setAdjustments(adjList);
      setBatches(batchesList);
      if (batchesList.length > 0) {
        setAdjBatchId(batchesList[0]._id);
      }
    } catch (err) {
      console.error('Failed to load returns and adjustments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Search original sale for return
  const handleLookupSale = async () => {
    if (!invoiceLookup.trim()) return;
    setLookupLoading(true);
    setReturnError(null);
    try {
      const res = await saleApi.getSales({ search: invoiceLookup.trim() });
      if (res.sales.length > 0) {
        const found = res.sales[0];
        setSaleFound(found);
        setReturnItems(
          found.items.map((item) => {
            const batchId =
              typeof item.batch === 'object' ? (item.batch as any)._id : item.batch;
            const medName =
              typeof item.medicine === 'object'
                ? (item.medicine as any).name
                : 'Medicine';

            return {
              batchId,
              batchNumber: item.batchNumber,
              medicineName: medName,
              maxReturnable: item.quantity,
              unitPrice: item.unitPrice,
              quantity: 0,
              condition: 'UNDAMAGED',
              restock: true,
            };
          })
        );
      } else {
        setReturnError(`No sale found matching "${invoiceLookup}".`);
        setSaleFound(null);
      }
    } catch (err: any) {
      setReturnError(err.response?.data?.message || 'Failed to lookup invoice.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleReturnItemChange = (index: number, field: string, val: any) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: val };
        // If condition is DAMAGED or EXPIRED, force restock to false
        if (field === 'condition' && (val === 'DAMAGED' || val === 'EXPIRED')) {
          updated.restock = false;
        }
        return updated;
      })
    );
  };

  const totalRefund = returnItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleFound) return;
    const itemsToReturn = returnItems.filter((i) => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      setReturnError('Please specify return quantity for at least one item.');
      return;
    }
    if (!returnReason.trim()) {
      setReturnError('Please provide a valid return reason.');
      return;
    }

    setReturnSubmitting(true);
    setReturnError(null);
    try {
      await returnApi.createReturn({
        saleId: saleFound._id,
        reason: returnReason.trim(),
        items: itemsToReturn.map((i) => ({
          batchId: i.batchId,
          quantity: Number(i.quantity),
          restock: i.restock,
          condition: i.condition,
        })),
      });

      setIsReturnModalOpen(false);
      setSaleFound(null);
      setInvoiceLookup('');
      fetchData();
    } catch (err: any) {
      setReturnError(err.response?.data?.message || 'Failed to process return.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjRemarks.trim()) {
      setAdjError('Audited adjustments require mandatory explanatory remarks.');
      return;
    }

    setAdjSubmitting(true);
    setAdjError(null);
    try {
      await adjustmentApi.createAdjustment({
        batchId: adjBatchId,
        adjustmentType: adjType,
        quantity: Number(adjQty),
        reasonCode: adjReason,
        remarks: adjRemarks.trim(),
      });

      setIsAdjModalOpen(false);
      setAdjRemarks('');
      setAdjQty(1);
      fetchData();
    } catch (err: any) {
      setAdjError(err.response?.data?.message || 'Failed to adjust batch stock.');
    } finally {
      setAdjSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Returns & Audited Stock Adjustments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Safely process customer invoice returns with restock controls and conduct non-negative inventory adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'returns' ? (
            <button
              onClick={() => {
                setSaleFound(null);
                setReturnError(null);
                setIsReturnModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Process Customer Return
            </button>
          ) : (
            <button
              onClick={() => {
                setAdjError(null);
                setIsAdjModalOpen(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Audit Stock Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('returns')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'returns'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Customer Returns ({returns.length})
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'adjustments'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Stock Adjustments ({adjustments.length})
        </button>
      </div>

      {/* Returns Tab Content */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <LoadingSpinner message="Loading customer return history..." />
          ) : returns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No customer returns processed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-5">Return #</th>
                    <th className="py-3 px-5">Invoice #</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Items Returned</th>
                    <th className="py-3 px-5">Reason</th>
                    <th className="py-3 px-5 text-right">Total Refund (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns.map((ret) => (
                    <tr key={ret._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                        {ret.returnNumber}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-medium text-slate-700">
                        {ret.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">
                        {new Date(ret.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="space-y-1">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-2 font-mono text-[11px]">
                              <span>
                                {it.batchNumber} ({it.quantityReturned} pcs)
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  it.restocked
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {it.restocked ? 'Restocked' : 'Quarantined'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600">{ret.reason}</td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-rose-600">
                        ₹{ret.totalRefundAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjustments Tab Content */}
      {activeTab === 'adjustments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <LoadingSpinner message="Loading audited adjustments..." />
          ) : adjustments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No stock adjustments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-5">Adj #</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Batch & Medicine</th>
                    <th className="py-3 px-5">Reason Code</th>
                    <th className="py-3 px-5 text-center">Previous</th>
                    <th className="py-3 px-5 text-center">Change</th>
                    <th className="py-3 px-5 text-center">New Balance</th>
                    <th className="py-3 px-5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adjustments.map((adj) => {
                    const batchNum =
                      typeof adj.batch === 'object' ? adj.batch.batchNumber : 'Batch';
                    const isIncrease = adj.adjustmentType === 'INCREASE';

                    return (
                      <tr key={adj._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                          {adj.adjustmentNumber}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {new Date(adj.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 font-mono font-semibold text-slate-800">
                          {batchNum}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                            {adj.reasonCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono text-slate-600">
                          {adj.previousQuantity}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold">
                          {isIncrease ? (
                            <span className="text-emerald-600">+{adj.quantity}</span>
                          ) : (
                            <span className="text-rose-600">-{adj.quantity}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-slate-900">
                          {adj.newQuantity}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">{adj.remarks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Return Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Process Customer Return & Restock Evaluation"
        subtitle="Validate against original transaction and enforce pharmaceutical safety standards"
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs">
          {returnError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {returnError}
            </div>
          )}

          {/* Invoice Lookup Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter original invoice number (e.g. INV-202611-0001)..."
              value={invoiceLookup}
              onChange={(e) => setInvoiceLookup(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 outline-none font-mono focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={lookupLoading}
              onClick={handleLookupSale}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition disabled:opacity-50"
            >
              {lookupLoading ? 'Finding...' : 'Find Sale'}
            </button>
          </div>

          {saleFound && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <div>
                  <p className="font-bold text-slate-900">Invoice #{saleFound.invoiceNumber}</p>
                  <p className="text-slate-500">Customer: {saleFound.customerName || 'Walk-in'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Date: {new Date(saleFound.createdAt).toLocaleDateString()}</p>
                  <p className="font-mono font-bold text-slate-900">Total: ₹{saleFound.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Items Return Table */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                  Select Items & Specify Condition
                </h4>
                {returnItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{item.medicineName}</span>
                      <span className="font-mono text-slate-500">
                        Batch: {item.batchNumber} (Max: {item.maxReturnable})
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Return Qty</label>
                        <input
                          type="number"
                          min="0"
                          max={item.maxReturnable}
                          value={item.quantity}
                          onChange={(e) =>
                            handleReturnItemChange(
                              idx,
                              'quantity',
                              Math.min(item.maxReturnable, Math.max(0, Number(e.target.value)))
                            )
                          }
                          className="w-full px-2 py-1 rounded border border-slate-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Condition</label>
                        <select
                          value={item.condition}
                          onChange={(e) => handleReturnItemChange(idx, 'condition', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-300"
                        >
                          <option value="UNDAMAGED">Undamaged (Seal Intact)</option>
                          <option value="DAMAGED">Damaged Package</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Restock Stock?</label>
                        <select
                          disabled={item.condition !== 'UNDAMAGED'}
                          value={item.restock ? 'yes' : 'no'}
                          onChange={(e) =>
                            handleReturnItemChange(idx, 'restock', e.target.value === 'yes')
                          }
                          className="w-full px-2 py-1 rounded border border-slate-300 disabled:opacity-50"
                        >
                          <option value="yes">Yes (Return to Batch)</option>
                          <option value="no">No (Quarantine / Scrap)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Return Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Doctor changed prescription dosage..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <div>
                  <span className="text-slate-500">Calculated Refund:</span>
                  <span className="font-mono text-base font-bold text-rose-600 ml-2">
                    ₹{totalRefund.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={returnSubmitting || totalRefund <= 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {returnSubmitting ? 'Processing...' : 'Authorize Refund & Return'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Adjustment Modal */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title="Perform Audited Stock Adjustment"
        subtitle="Mandatory regulatory audit trail for physical inventory reconciliation"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs">
          {adjError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {adjError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Select Batch to Adjust *</label>
            <select
              value={adjBatchId}
              onChange={(e) => setAdjBatchId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
            >
              {batches.map((b) => {
                const medName =
                  typeof b.medicine === 'object' ? b.medicine.name : 'Medicine';
                return (
                  <option key={b._id} value={b._id}>
                    {b.batchNumber} - {medName} (Avail: {b.availableQuantity})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Adjustment Type *</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
              >
                <option value="DECREASE">Decrease Stock (Write-off)</option>
                <option value="INCREASE">Increase Stock (Found Stock)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={adjQty}
                onChange={(e) => setAdjQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason Code *</label>
            <select
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
            >
              <option value="COUNT_CORRECTION">Count Correction / Physical Audit</option>
              <option value="DAMAGE">Damaged in Storage / Vial Broken</option>
              <option value="EXPIRED_SCRAPPED">Expired & Scrapped for Destruction</option>
              <option value="THEFT">Pilferage / Unaccounted Loss</option>
              <option value="BREAKAGE">Breakage during Handling</option>
              <option value="OTHER">Other Operational Discrepancy</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Explanatory Remarks * (Mandatory for Audit Trail)
            </label>
            <textarea
              required
              rows={3}
              value={adjRemarks}
              onChange={(e) => setAdjRemarks(e.target.value)}
              placeholder="Detail the root cause and pharmacist sign-off..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdjModalOpen(false)}
              className="px-4 py-2 border rounded-xl text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjSubmitting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50"
            >
              {adjSubmitting ? 'Applying Adjustment...' : 'Record Stock Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
