import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { inventoryApi, masterDataApi } from '../../services/api';
import type { Purchase, Supplier, Medicine } from '../../types';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

interface InwardItem {
  medicine: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
}

export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Consignment Form State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InwardItem[]>([
    {
      medicine: '',
      batchNumber: '',
      manufacturingDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      purchasePrice: 10,
      sellingPrice: 15,
      quantity: 100,
    },
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppsRes, medsRes] = await Promise.all([
        inventoryApi.getPurchases({ limit: 50 }),
        masterDataApi.getSuppliers({ isActive: true }),
        masterDataApi.getMedicines({ isActive: true, limit: 100 }),
      ]);
      const purchasesList = Array.isArray(purchasesRes) ? purchasesRes : (purchasesRes?.purchases || []);
      const suppsList = Array.isArray(suppsRes) ? suppsRes : ((suppsRes as any)?.suppliers || []);
      const medsList = Array.isArray(medsRes) ? medsRes : (medsRes?.medicines || []);

      setPurchases(purchasesList);
      setSuppliers(suppsList);
      setMedicines(medsList);

      if (suppsList.length > 0) setSelectedSupplier(suppsList[0]._id);
      if (medsList.length > 0) {
        setItems([
          {
            medicine: medsList[0]._id,
            batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
            manufacturingDate: new Date().toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            purchasePrice: 10,
            sellingPrice: 15,
            quantity: 100,
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItemRow = () => {
    if (medicines.length === 0) return;
    setItems((prev) => [
      ...prev,
      {
        medicine: medicines[0]._id,
        batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
        manufacturingDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        purchasePrice: 10,
        sellingPrice: 15,
        quantity: 100,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InwardItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const totalConsignmentCost = items.reduce(
    (sum, item) => sum + (Number(item.purchasePrice) || 0) * (Number(item.quantity) || 0),
    0
  );

  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);

    // Validation
    if (!selectedSupplier) {
      setModalError('Please select a verified supplier.');
      setModalSubmitting(false);
      return;
    }
    if (!supplierInvoiceNumber.trim()) {
      setModalError('Please provide the supplier invoice or delivery challan number.');
      setModalSubmitting(false);
      return;
    }

    try {
      await inventoryApi.createPurchase({
        supplier: selectedSupplier,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        receivedDate,
        items: items.map((i) => ({
          medicine: i.medicine,
          batchNumber: i.batchNumber.trim().toUpperCase(),
          manufacturingDate: i.manufacturingDate,
          expiryDate: i.expiryDate,
          purchasePrice: Number(i.purchasePrice),
          sellingPrice: Number(i.sellingPrice),
          quantity: Number(i.quantity),
        })),
        notes: notes.trim() || undefined,
      });

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to receive stock consignment.');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Purchase Orders & Stock Inward
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Receive incoming medicine consignments, create discrete batch records, and record purchase history.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
        >
          <PackageCheck className="w-4 h-4" />
          Receive Inward Stock
        </button>
      </div>

      {/* Consignments List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Inward Consignments History
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Total Orders: {purchases.length}
          </span>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading purchase orders..." />
        ) : purchases.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No stock consignments received yet. Click "Receive Inward Stock" above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-5">PO Number</th>
                  <th className="py-3 px-5">Supplier</th>
                  <th className="py-3 px-5">Supplier Invoice #</th>
                  <th className="py-3 px-5">Received Date</th>
                  <th className="py-3 px-5 text-center">Batches / Items</th>
                  <th className="py-3 px-5 text-right">Total Inward Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => {
                  const suppName =
                    typeof p.supplier === 'object' ? p.supplier.name : 'Supplier';

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                        {p.purchaseOrderNumber}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-800">{suppName}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-600">
                        {p.supplierInvoiceNumber}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">
                        {new Date(p.receivedDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono">
                        <span className="font-bold text-slate-900">{p.items.length}</span> batch(es)
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700">
                        ₹{p.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Inward Consignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Receive Inward Stock Consignment"
        subtitle="Ingest medicine batches into active inventory and generate stock movements"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitInward} className="space-y-5 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Supplier & Invoice metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
              <select
                required
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none bg-white focus:border-emerald-500"
              >
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.contactPerson})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Supplier Invoice # *</label>
              <input
                type="text"
                required
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-SUPP-2026-99"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-mono focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Received Date</label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-mono focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Consignment Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cold-chain verification, transporter details, or parcel condition..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none text-xs"
            />
          </div>

          {/* Line items dynamic table */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Inward Batches ({items.length})
              </h4>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medicine Batch
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 text-[11px]">Line Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Medicine *</label>
                      <select
                        value={item.medicine}
                        onChange={(e) => handleItemChange(idx, 'medicine', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs outline-none"
                      >
                        {medicines.map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.name} ({m.dosageForm})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Batch # *</label>
                      <input
                        type="text"
                        required
                        value={item.batchNumber}
                        onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Mfg Date</label>
                      <input
                        type="date"
                        required
                        value={item.manufacturingDate}
                        onChange={(e) => handleItemChange(idx, 'manufacturingDate', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Expiry Date *</label>
                      <input
                        type="date"
                        required
                        value={item.expiryDate}
                        onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cost / Sell (₹)</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={item.purchasePrice}
                          onChange={(e) => handleItemChange(idx, 'purchasePrice', e.target.value)}
                          placeholder="Cost"
                          className="w-1/2 px-1 py-1.5 rounded-lg border border-slate-300 text-xs font-mono outline-none"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={item.sellingPrice}
                          onChange={(e) => handleItemChange(idx, 'sellingPrice', e.target.value)}
                          placeholder="Sell"
                          className="w-1/2 px-1 py-1.5 rounded-lg border border-slate-300 text-xs font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consignment Total & Submit */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <div>
              <span className="text-slate-500">Total Purchase Valuation:</span>
              <span className="ml-2 font-mono text-base font-extrabold text-emerald-700">
                ₹{totalConsignmentCost.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
              >
                {modalSubmitting ? 'Receiving Inward Stock...' : 'Ingest Stock Consignment'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
