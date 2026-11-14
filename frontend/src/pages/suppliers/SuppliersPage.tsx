import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Phone, Mail } from 'lucide-react';
import { masterDataApi } from '../../services/api';
import type { Supplier } from '../../types';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await masterDataApi.getSuppliers({ search: search || undefined });
      setSuppliers(Array.isArray(data) ? data : ((data as any)?.suppliers || []));
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      gstin: '',
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address || '',
      gstin: s.gstin || '',
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);
    try {
      if (editingSupplier) {
        await masterDataApi.updateSupplier(editingSupplier._id, formData);
      } else {
        await masterDataApi.createSupplier(formData);
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to save supplier.');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Suppliers Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage pharmaceutical vendors, distributors, contact details, and procurement links.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Add New Supplier
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers by corporate name, contact person, or email..."
          className="w-full text-xs outline-none bg-transparent"
        />
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <LoadingSpinner message="Querying supplier directory..." />
        ) : suppliers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No suppliers found. Click "Add New Supplier" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-5">Supplier Name</th>
                  <th className="py-3 px-5">Contact Person</th>
                  <th className="py-3 px-5">Contact Info</th>
                  <th className="py-3 px-5">GSTIN / Tax ID</th>
                  <th className="py-3 px-5">Address</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{s.name}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 font-medium">{s.contactPerson}</td>
                    <td className="py-3.5 px-5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" /> {s.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Mail className="w-3 h-3 text-slate-400" /> {s.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-600 font-medium">
                      {s.gstin || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 max-w-xs truncate">
                      {s.address || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Badge variant={s.isActive ? 'success' : 'neutral'} size="sm">
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                        title="Edit Supplier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier Record' : 'Register New Pharmaceutical Supplier'}
        subtitle="Maintain vendor compliance details for purchase order receipts"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {modalError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Company / Supplier Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Apex Health Logistics Pvt Ltd"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Person *</label>
              <input
                type="text"
                required
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="e.g. Vikram Sharma"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 00000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="orders@apexhealth.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="27AABCU9603R1ZM"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono outline-none focus:border-emerald-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Warehouse / Office Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Building, Street, Pharma Zone, City, State..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {modalSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
