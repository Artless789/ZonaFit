import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { SubscriptionGuard } from '../guards/SubscriptionGuard';
import { Login } from '../pages/Login';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const AuditPage = lazy(() => import('../pages/audit/AuditPage').then(module => ({ default: module.AuditPage })));
const ClientsPage = lazy(() => import('../pages/clients/ClientsPage').then(module => ({ default: module.ClientsPage })));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then(module => ({ default: module.DashboardPage })));
const MembershipsPage = lazy(() => import('../pages/memberships/MembershipsPage').then(module => ({ default: module.MembershipsPage })));
const InvoicesPage = lazy(() => import('../pages/invoices/InvoicesPage').then(module => ({ default: module.InvoicesPage })));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const UsersPage = lazy(() => import('../pages/users/UsersPage').then(module => ({ default: module.UsersPage })));
const SalesPage = lazy(() => import('../pages/sales/SalesPage').then(module => ({ default: module.SalesPage })));
const CreditsPage = lazy(() => import('../pages/credits/CreditsPage').then(module => ({ default: module.CreditsPage })));
const CashRegisterPage = lazy(() => import('../pages/cash_registers/CashRegisterPage').then(module => ({ default: module.CashRegisterPage })));
const GymSettingsPage = lazy(() => import('../pages/GymSettings').then(module => ({ default: module.GymSettingsPage })));
const SubscriptionManagementPage = lazy(() => import('../pages/subscription/SubscriptionManagementPage').then(module => ({ default: module.SubscriptionManagementPage })));
const SubscriptionCheckoutPage = lazy(() => import('../pages/subscription/SubscriptionCheckoutPage').then(module => ({ default: module.SubscriptionCheckoutPage })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg-screen">
    <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
  </div>
);

export function AppOperativaRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login isApp={true} />} />
        
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route element={<SubscriptionGuard />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="memberships" element={<MembershipsPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="cash-registers" element={<CashRegisterPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<GymSettingsPage />} />
            <Route path="settings/subscription" element={<SubscriptionManagementPage />} />
            <Route path="subscription/checkout" element={<SubscriptionCheckoutPage />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
