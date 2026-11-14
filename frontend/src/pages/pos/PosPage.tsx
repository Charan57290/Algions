import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  Printer,
  Sparkles,
} from 'lucide-react';
import { masterDataApi, saleApi } from '../../services/api';
import type { Medicine, FefoPreviewResponse, InvoicePayload } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { InvoiceModal } from '../../components/common/InvoiceModal';

interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export const PosPage: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [fefoPreviews, setFefoPreviews] = useState<Record<string, FefoPreviewResponse>>({});
  const [loadingFefo, setLoadingFefo] = useState(false);

  // Customer & Billing details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'NET_BANKING'>('CASH');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invoice modal state
  const [generatedInvoice, setGeneratedInvoice] = useState<InvoicePayload | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Fetch medicines when search query changes
  useEffect(() => {
    const fetchMeds = async () => {
      setLoadingMedicines(true);
      try {
        const res = await masterDataApi.getMedicines({
          search: searchQuery,
          isActive: true,
          limit: 30,
        });
        const list = Array.isArray(res) ? res : (res?.medicines || []);
        setMedicines(list);
      } catch (err) {
        console.error('Failed to load medicines:', err);
      } finally {
        setLoadingMedicines(false);
      }
    };

    const timer = setTimeout(fetchMeds, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update FEFO allocation preview whenever cart changes
  useEffect(() => {
    if (cart.length === 0) {
      setFefoPreviews({});
      return;
    }

    const fetchFefo = async () => {
      setLoadingFefo(true);
      try {
        const payload = cart.map((item) => ({
          medicineId: item.medicine._id,
          quantity: item.quantity,
        }));
        const previews = await saleApi.previewFefo(payload);
        const map: Record<string, FefoPreviewResponse> = {};
        previews.forEach((p) => {
          map[p.medicineId] = p;
        });
        setFefoPreviews(map);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(
          err.response?.data?.message || 'FEFO Allocation error: insufficient non-expired stock'
        );
      } finally {
        setLoadingFefo(false);
      }
    };

    fetchFefo();
  }, [cart]);

  const addToCart = (med: Medicine) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.medicine._id === med._id);
      if (existing) {
        return prev.map((item) =>
          item.medicine._id === med._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { medicine: med, quantity: 1 }];
    });
  };

  const updateQuantity = (medicineId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(medicineId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.medicine._id === medicineId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeFromCart = (medicineId: string) => {
    setCart((prev) => prev.filter((item) => item.medicine._id !== medicineId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setPrescriptionNumber('');
    setDiscountAmount(0);
    setCheckoutNotes('');
    setErrorMessage(null);
  };

  // Financial Calculations
  const subtotal = Object.values(fefoPreviews).reduce((sum, p) => sum + (p.subtotal || 0), 0);
  const taxAmount = (subtotal - discountAmount) * 0.12; // 12% GST
  const netPayable = Math.max(0, subtotal - discountAmount + taxAmount);

  const canCheckout =
    cart.length > 0 &&
    !loadingFefo &&
    Object.values(fefoPreviews).every((p) => p.isFullyAllocated);

  const handleCheckout = async () => {
    if (!canCheckout) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        items: cart.map((item) => ({
          medicineId: item.medicine._id,
          quantity: item.quantity,
        })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        doctorName: doctorName.trim() || undefined,
        prescriptionNumber: prescriptionNumber.trim() || undefined,
        paymentMethod,
        discountAmount: Number(discountAmount) || 0,
        notes: checkoutNotes.trim() || undefined,
      };

      const sale = await saleApi.createSale(payload);
      const invoice = await saleApi.getInvoice(sale._id);
      setGeneratedInvoice(invoice);
      setShowInvoiceModal(true);
      clearCart();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Transaction processing failed. Please check stock.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Medicine Catalogue & Search (7 Cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by brand, generic name, dosage, or barcode (e.g. Paracetamol, Dolo, 890123...)"
            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-md"
            >
              Clear
            </button>
          )}
        </div>

        {/* Medicines Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Available Medicines ({(medicines || []).length})
            </h3>
            <span className="text-[11px] text-slate-400">Click to add to billing tray</span>
          </div>

          {loadingMedicines ? (
            <LoadingSpinner message="Searching medicine catalogue..." />
          ) : (medicines || []).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No matching medicines found for "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {(medicines || []).map((med) => {
                const stock = med.totalAvailableStock || 0;
                const isOutOfStock = stock <= 0;
                const inCart = cart.some((c) => c.medicine._id === med._id);

                return (
                  <div
                    key={med._id}
                    onClick={() => !isOutOfStock && addToCart(med)}
                    className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-50 border-slate-200 bg-slate-50 cursor-not-allowed'
                        : inCart
                        ? 'border-emerald-500 bg-emerald-50/30 cursor-pointer shadow-xs'
                        : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {med.name}
                        </h4>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {med.dosageForm}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{med.genericName}</p>
                      <p className="text-[11px] text-slate-400">
                        {med.strength} • {med.manufacturer}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span
                        className={`font-semibold ${
                          isOutOfStock
                            ? 'text-rose-600'
                            : stock < (med.reorderThreshold || 10)
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : `${stock} ${med.unitOfMeasurement}s`}
                      </span>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          isOutOfStock
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : inCart
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white'
                        }`}
                      >
                        {inCart ? 'Added' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Cart, FEFO Inspection & Checkout Tray (5 Cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Cart & FEFO Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Billing Tray</h3>
              <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                {cart.length}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
              >
                Clear All
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="my-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart Item Rows */}
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Your cart is empty. Search and add medicines from the catalogue on the left.
              </div>
            ) : (
              cart.map((item) => {
                const preview = fefoPreviews[item.medicine._id];
                const isUnderAllocated = preview && !preview.isFullyAllocated;

                return (
                  <div
                    key={item.medicine._id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900">{item.medicine.name}</h4>
                        <p className="text-[11px] text-slate-500">
                          {item.medicine.dosageForm} • {item.medicine.strength}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.medicine._id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item.medicine._id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.medicine._id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          ₹{preview ? preview.subtotal.toFixed(2) : '...'}
                        </span>
                      </div>
                    </div>

                    {/* FEFO Batch Allocation Breakdown Box */}
                    {preview && preview.allocations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/80 bg-emerald-50/50 rounded-lg p-2 text-[11px]">
                        <p className="font-bold text-emerald-900 flex items-center gap-1 mb-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          FEFO Batch Allocation ({preview.allocations.length} batch
                          {preview.allocations.length > 1 ? 'es' : ''}):
                        </p>
                        <div className="space-y-1">
                          {preview.allocations.map((alloc) => (
                            <div
                              key={alloc.batchId}
                              className="flex justify-between items-center text-slate-600 font-mono"
                            >
                              <span>
                                {alloc.batchNumber} (Exp:{' '}
                                {new Date(alloc.expiryDate).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                ):
                              </span>
                              <span className="font-bold text-slate-900">
                                {alloc.allocatedQuantity} pcs @ ₹{alloc.unitPrice}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isUnderAllocated && (
                      <div className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Only {preview?.allocatedQuantity} units available before expiry!
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Customer Metadata Inputs */}
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Customer & Doctor Info
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
              <input
                type="tel"
                placeholder="Phone (10 digits)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Doctor Name (Optional)"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Prescription # (Optional)"
                value={prescriptionNumber}
                onChange={(e) => setPrescriptionNumber(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Payment Method
            </h4>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {(['CASH', 'UPI', 'CARD', 'NET_BANKING'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-1 rounded-lg border text-center font-bold transition ${
                    paymentMethod === method
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span className="font-mono font-medium text-slate-900">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Discount (₹):</span>
              <input
                type="number"
                min="0"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                placeholder="0.00"
                className="w-24 text-right px-2 py-1 rounded border border-slate-300 font-mono text-xs outline-none"
              />
            </div>
            <div className="flex justify-between">
              <span>GST (12%):</span>
              <span className="font-mono font-medium text-slate-900">₹{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-900">
              <span>Total Payable:</span>
              <span className="font-mono text-emerald-700">₹{netPayable.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            disabled={!canCheckout || isSubmitting}
            onClick={handleCheckout}
            className="mt-5 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            {isSubmitting ? 'Processing Transaction...' : 'Complete Sale & Print Invoice'}
          </button>
        </div>
      </div>

      {/* Invoice Modal for Immediate Printing */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoice={generatedInvoice}
      />
    </div>
  );
};
