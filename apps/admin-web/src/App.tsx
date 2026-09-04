import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { ToastProvider } from '@wag/ui-web';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import PartnersPage from './pages/PartnersPage';
import PayoutsPage from './pages/PayoutsPage';
import CouponsPage from './pages/CouponsPage';
import PackagesPage from './pages/PackagesPage';
import ProductsPage from './pages/ProductsPage';
import BookingsPage from './pages/BookingsPage';
import CustomersPage from './pages/CustomersPage';
import AuditLogPage from './pages/AuditLogPage';
import StaffPage from './pages/StaffPage';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <RequireAdmin>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/partners" element={<PartnersPage />} />
                <Route path="/payouts" element={<PayoutsPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/packages" element={<PackagesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
              </Routes>
            </AppLayout>
          </RequireAdmin>
        } />
      </Routes>
    </ToastProvider>
  );
}
