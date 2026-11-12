import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

const routeTitleMap: Record<string, string> = {
  '/': 'Operational Dashboard',
  '/pos': 'Point of Sale (POS) Billing',
  '/medicines': 'Medicines & Product Catalogue',
  '/inventory': 'Batch-Level Inventory & Valuations',
  '/purchases': 'Stock Receiving & Purchase Orders',
  '/returns': 'Returns & Audited Adjustments',
  '/suppliers': 'Suppliers Management',
  '/reports': 'Analytical Reports & Reconciliation',
  '/users': 'Staff & User Access Control',
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const title = routeTitleMap[location.pathname] || 'Pharmacy Management';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar pageTitle={title} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
