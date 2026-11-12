import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../services/api';
import { Link } from 'react-router-dom';

interface NavbarProps {
  pageTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ pageTitle = 'Dashboard' }) => {
  const { user, logout, isPharmacist } = useAuth();
  const [alertCount, setAlertCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      if (isPharmacist) {
        try {
          const kpis = await reportApi.getDashboardKPIs();
          if (isMounted) {
            const count =
              (kpis.inventory.lowStockCount || 0) +
              (kpis.inventory.expiringWithin30DaysCount || 0) +
              (kpis.inventory.expiredBatchesCount || 0);
            setAlertCount(count);
          }
        } catch {
          // Soft fail for non-critical counter
        }
      }
    };
    fetchAlerts();
    return () => {
      isMounted = false;
    };
  }, [isPharmacist]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Alerts Pill if any */}
        {isPharmacist && alertCount > 0 && (
          <Link
            to="/reports"
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{alertCount} Stock Alert{alertCount > 1 ? 's' : ''}</span>
          </Link>
        )}

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{user?.email}</p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
