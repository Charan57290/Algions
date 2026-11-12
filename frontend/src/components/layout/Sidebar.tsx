import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Boxes,
  Truck,
  RotateCcw,
  BarChart3,
  Users,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, isAdmin, isPharmacist } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      allowed: ['ADMIN', 'PHARMACIST', 'CUSTOMER'],
    },
    {
      label: 'POS Billing',
      path: '/pos',
      icon: ShoppingCart,
      allowed: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: 'Medicines',
      path: '/medicines',
      icon: Pill,
      allowed: ['ADMIN', 'PHARMACIST', 'CUSTOMER'],
    },
    {
      label: 'Batch Inventory',
      path: '/inventory',
      icon: Boxes,
      allowed: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: 'Stock Inward (PO)',
      path: '/purchases',
      icon: PackageCheck,
      allowed: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: 'Returns & Adjustments',
      path: '/returns',
      icon: RotateCcw,
      allowed: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: 'Suppliers',
      path: '/suppliers',
      icon: Truck,
      allowed: ['ADMIN'],
    },
    {
      label: 'Reports & Analytics',
      path: '/reports',
      icon: BarChart3,
      allowed: ['ADMIN'],
    },
    {
      label: 'User Management',
      path: '/users',
      icon: Users,
      allowed: ['ADMIN'],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    user ? item.allowed.includes(user.role) : false
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950/40">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center font-black text-xl shadow-md">
          Rx
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Algions Rx</h1>
          <p className="text-[11px] text-emerald-400 font-medium">Pharmacy System</p>
        </div>
      </div>

      {/* Role Pill Banner */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Role</span>
        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
            isAdmin
              ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
              : isPharmacist
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
              : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
          }`}
        >
          {user?.role}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-900/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30 text-[11px] text-slate-500 text-center">
        Algions AI Labs Assessment
        <div className="text-[10px] text-slate-600 font-mono mt-0.5">v1.0.0-PROD</div>
      </div>
    </aside>
  );
};
