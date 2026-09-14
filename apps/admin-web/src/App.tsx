import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { ToastProvider } from '@wag/ui-web';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import BookingDetailPage from './pages/BookingDetailPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import PartnersPage from './pages/PartnersPage';
import PartnerDetailPage from './pages/PartnerDetailPage';
import PayoutsPage from './pages/PayoutsPage';
import CouponsPage from './pages/CouponsPage';
import PackagesPage from './pages/PackagesPage';
import ProductsPage from './pages/ProductsPage';
import BookingsPage from './pages/BookingsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import AuditLogPage from './pages/AuditLogPage';
import StaffPage from './pages/StaffPage';
import SupportPage from './pages/SupportPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import AreasPage from './pages/AreasPage';
import SettingsPage from './pages/SettingsPage';

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
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/partners" element={<PartnersPage />} />
                <Route path="/partners/:id" element={<PartnerDetailPage />} />
                <Route path="/payouts" element={<PayoutsPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/packages" element={<PackagesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/areas" element={<AreasPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppLayout>
          </RequireAdmin>
        } />
      </Routes>
    </ToastProvider>
  );
}
