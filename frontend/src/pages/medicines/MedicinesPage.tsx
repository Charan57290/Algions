import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  AlertTriangle,
} from 'lucide-react';
import { masterDataApi } from '../../services/api';
import type { Medicine, Category, DosageForm } from '../../types';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

export const MedicinesPage: React.FC = () => {
  const { isPharmacist } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDosage, setSelectedDosage] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    brandName: '',
    category: '',
    manufacturer: '',
    description: '',
    dosageForm: 'TABLET' as DosageForm,
    strength: '',
    barcode: '',
    sku: '',
    unitOfMeasurement: 'STRIP',
    reorderThreshold: 20,
    requiresPrescription: false,
  });

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const [medsRes, catsRes] = await Promise.all([
        masterDataApi.getMedicines({
          search: search || undefined,
          category: selectedCategory || undefined,
          dosageForm: selectedDosage || undefined,
          lowStockOnly: lowStockOnly || undefined,
          limit: 100,
        }),
        masterDataApi.getCategories({ isActive: true }),
      ]);
      setMedicines(medsRes.medicines);
      setCategories(catsRes);
    } catch (err) {
      console.error('Failed to fetch medicines data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchMedicines, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedDosage, lowStockOnly]);

  const handleOpenAdd = () => {
    setEditingMedicine(null);
    setFormData({
      name: '',
      genericName: '',
      brandName: '',
      category: categories[0]?._id || '',
      manufacturer: '',
      description: '',
      dosageForm: 'TABLET',
      strength: '500mg',
      barcode: '',
      sku: '',
      unitOfMeasurement: 'STRIP',
      reorderThreshold: 20,
      requiresPrescription: false,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (med: Medicine) => {
    setEditingMedicine(med);
    const catId = typeof med.category === 'object' ? med.category._id : med.category;
    setFormData({
      name: med.name,
      genericName: med.genericName,
      brandName: med.brandName || '',
      category: catId,
      manufacturer: med.manufacturer,
      description: med.description || '',
      dosageForm: med.dosageForm,
      strength: med.strength,
      barcode: med.barcode || '',
      sku: med.sku,
      unitOfMeasurement: med.unitOfMeasurement,
      reorderThreshold: med.reorderThreshold,
      requiresPrescription: med.requiresPrescription,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);
    try {
      if (editingMedicine) {
        await masterDataApi.updateMedicine(editingMedicine._id, formData);
      } else {
        await masterDataApi.createMedicine(formData);
      }
      setIsModalOpen(false);
      fetchMedicines();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to save medicine.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const dosageForms: DosageForm[] = [
    'TABLET',
    'CAPSULE',
    'SYRUP',
    'INJECTION',
    'OINTMENT',
    'DROPS',
    'INHALER',
    'POWDER',
    'OTHER',
  ];

  return (
    <div className="space-y-6">
      {/* Top Action & Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Medicine Catalogue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pharmaceutical database with active batch stock aggregation and reorder tracking.
          </p>
        </div>

        {isPharmacist && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add New Medicine
          </button>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, generic, SKU, or barcode..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-700 focus:border-emerald-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedDosage}
          onChange={(e) => setSelectedDosage(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-700 focus:border-emerald-500"
        >
          <option value="">All Dosage Forms</option>
          {dosageForms.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
          />
          <span>Low Stock Reorders Only</span>
        </label>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <LoadingSpinner message="Loading pharmaceutical catalogue..." />
        ) : medicines.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No medicines match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-5">Medicine & Brand</th>
                  <th className="py-3 px-5">Generic Composition</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Form & Strength</th>
                  <th className="py-3 px-5">SKU / Barcode</th>
                  <th className="py-3 px-5 text-center">Available Stock</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  {isPharmacist && <th className="py-3 px-5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((med) => {
                  const stock = med.totalAvailableStock || 0;
                  const isLow = stock < (med.reorderThreshold || 10);
                  const catName =
                    typeof med.category === 'object' ? med.category.name : 'Unassigned';

                  return (
                    <tr key={med._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900">{med.name}</div>
                        {med.brandName && (
                          <div className="text-[11px] text-slate-500">Brand: {med.brandName}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-medium">{med.genericName}</td>
                      <td className="py-3.5 px-5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {catName}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-slate-800">{med.dosageForm}</span>
                        <div className="text-[11px] text-slate-500">{med.strength}</div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px]">
                        <div>{med.sku}</div>
                        {med.barcode && <div className="text-slate-400">{med.barcode}</div>}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-bold font-mono text-sm ${
                              stock === 0
                                ? 'text-rose-600'
                                : isLow
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {stock} {med.unitOfMeasurement}s
                          </span>
                          {isLow && (
                            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5 mt-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Below {med.reorderThreshold}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <Badge variant={med.isActive ? 'success' : 'neutral'} size="sm">
                          {med.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      {isPharmacist && (
                        <td className="py-3.5 px-5 text-center">
                          <button
                            onClick={() => handleOpenEdit(med)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title="Edit Medicine"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMedicine ? 'Edit Medicine Master Record' : 'Register New Pharmaceutical Product'}
        subtitle="Maintain accurate catalogue details for clinical compliance and inventory tracking"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveMedicine} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Medicine Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Paracetamol 500mg Tablets"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Generic Name *</label>
              <input
                type="text"
                required
                value={formData.genericName}
                onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                placeholder="e.g. Acetaminophen"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Brand Name</label>
              <input
                type="text"
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                placeholder="e.g. Dolo 650"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Manufacturer *</label>
              <input
                type="text"
                required
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g. Sun Pharma Labs"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dosage Form *</label>
              <select
                value={formData.dosageForm}
                onChange={(e) =>
                  setFormData({ ...formData, dosageForm: e.target.value as DosageForm })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              >
                {dosageForms.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Strength *</label>
              <input
                type="text"
                required
                value={formData.strength}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                placeholder="e.g. 500mg / 5ml"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit of Measure *</label>
              <input
                type="text"
                required
                value={formData.unitOfMeasurement}
                onChange={(e) => setFormData({ ...formData, unitOfMeasurement: e.target.value })}
                placeholder="e.g. STRIP / BOTTLE"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">SKU / Code *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. MED-PARA-500"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 8901234567890"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reorder Threshold *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.reorderThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, reorderThreshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Clinical Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Indications, precautions, and packaging details..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="prescriptionToggle"
              checked={formData.requiresPrescription}
              onChange={(e) =>
                setFormData({ ...formData, requiresPrescription: e.target.checked })
              }
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <label htmlFor="prescriptionToggle" className="font-semibold text-slate-700 cursor-pointer">
              Schedule H / Rx Prescription Required for Dispensing
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
              {modalSubmitting ? 'Saving...' : editingMedicine ? 'Update Medicine' : 'Create Medicine'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
