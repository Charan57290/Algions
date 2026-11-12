import React, { useRef } from 'react';
import { Printer, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import type { InvoicePayload } from '../../types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoicePayload | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pharmacy Tax Invoice"
      subtitle={`Invoice #${invoice.invoice.invoiceNumber}`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Printable Area */}
        <div
          ref={printRef}
          id="printable-invoice"
          className="bg-white p-8 rounded-xl border border-slate-200 text-slate-800 font-sans shadow-sm print:m-0 print:p-0 print:border-none print:shadow-none"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-extrabold text-emerald-600">Rx</span>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  {invoice.pharmacyDetails.name}
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {invoice.pharmacyDetails.tagline}
              </p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                {invoice.pharmacyDetails.address}
              </p>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4">
                <span>Phone: {invoice.pharmacyDetails.phone}</span>
                <span>Email: {invoice.pharmacyDetails.email}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase rounded-md tracking-wider mb-2">
                Tax Invoice
              </span>
              <p className="text-lg font-bold text-slate-900">
                {invoice.invoice.invoiceNumber}
              </p>
              <p className="text-xs text-slate-500">
                Date: {new Date(invoice.invoice.date).toLocaleString()}
              </p>
              <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                <p>GSTIN: <span className="font-mono font-medium">{invoice.pharmacyDetails.gstin}</span></p>
                <p>DL No: <span className="font-mono font-medium">{invoice.pharmacyDetails.dlNumber}</span></p>
              </div>
            </div>
          </div>

          {/* Customer & Doctor Metadata */}
          <div className="grid grid-cols-2 gap-6 my-5 p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Billed To</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {invoice.invoice.customerName || 'Walk-in Customer'}
              </p>
              {invoice.invoice.customerPhone && (
                <p className="text-slate-600">Phone: {invoice.invoice.customerPhone}</p>
              )}
              {invoice.invoice.doctorName && (
                <p className="text-slate-600 mt-1">Prescribed By: <span className="font-medium">Dr. {invoice.invoice.doctorName}</span></p>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Transaction Info</span>
              <p className="text-slate-700 mt-0.5">Cashier: <span className="font-semibold text-slate-900">{invoice.invoice.cashierName}</span></p>
              <p className="text-slate-700">Payment: <span className="font-semibold text-slate-900">{invoice.invoice.paymentMethod}</span></p>
              <p className="text-emerald-600 font-semibold flex items-center justify-end gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {invoice.invoice.paymentStatus}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100/70 text-slate-700 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Medicine & Strength</th>
                  <th className="py-2.5 px-3">Batch No</th>
                  <th className="py-2.5 px-3">Expiry</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <tr key={`${item.batchNumber}-${item.itemNumber}`} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.itemNumber}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">{item.medicineName}</p>
                      <p className="text-[11px] text-slate-500">{item.dosageForm} • {item.strength}</p>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{item.batchNumber}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {new Date(item.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{item.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="border-t border-slate-200 mt-6 pt-4 flex justify-between items-start">
            <div className="text-[11px] text-slate-500 max-w-sm space-y-1">
              <p className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">Terms & Conditions</p>
              {invoice.termsAndConditions?.map((term, idx) => (
                <p key={idx}>• {term}</p>
              ))}
            </div>

            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{invoice.financialSummary.subtotal.toFixed(2)}</span>
              </div>
              {invoice.financialSummary.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{invoice.financialSummary.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>GST (Incl.):</span>
                <span className="font-mono">₹{invoice.financialSummary.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t-2 border-slate-900">
                <span>Net Payable:</span>
                <span className="font-mono text-emerald-700">₹{invoice.financialSummary.netPayable.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Thank you for trusting {invoice.pharmacyDetails.name}. Prompt medication administration saves lives.
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};
