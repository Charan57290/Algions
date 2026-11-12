import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PosPage } from './pages/pos/PosPage';
import { MedicinesPage } from './pages/medicines/MedicinesPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { PurchasesPage } from './pages/purchases/PurchasesPage';
import { ReturnsPage } from './pages/returns/ReturnsPage';
import { SuppliersPage } from './pages/suppliers/SuppliersPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { UsersPage } from './pages/users/UsersPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes inside AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/medicines" element={<MedicinesPage />} />

              {/* Pharmacist & Admin Accessible */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST']} />}>
                <Route path="/pos" element={<PosPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/returns" element={<ReturnsPage />} />
              </Route>

              {/* Admin-Only Accessible */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
