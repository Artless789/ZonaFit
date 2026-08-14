import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { SubscriptionGuard } from '../guards/SubscriptionGuard';
import { Landing } from '../pages/Landing';
import { Login } from '../pages/Login';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DemoLayout } from '../demo/DemoLayout';

const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword').then(module => ({ default: module.ResetPassword })));
const Register = lazy(() => import('../pages/Register').then(module => ({ default: module.Register })));
const Onboarding = lazy(() => import('../pages/Onboarding').then(module => ({ default: module.Onboarding })));
const AuditPage = lazy(() => import('../pages/audit/AuditPage').then(module => ({ default: module.AuditPage })));
const ClientsPage = lazy(() => import('../pages/clients/ClientsPage').then(module => ({ default: module.ClientsPage })));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then(module => ({ default: module.DashboardPage })));
const GymSettingsPage = lazy(() => import('../pages/GymSettings').then(module => ({ default: module.GymSettingsPage })));
const MembershipsPage = lazy(() => import('../pages/memberships/MembershipsPage').then(module => ({ default: module.MembershipsPage })));
const InvoicesPage = lazy(() => import('../pages/invoices/InvoicesPage').then(module => ({ default: module.InvoicesPage })));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const UsersPage = lazy(() => import('../pages/users/UsersPage').then(module => ({ default: module.UsersPage })));
const SalesPage = lazy(() => import('../pages/sales/SalesPage').then(module => ({ default: module.SalesPage })));
const SubscriptionCheckoutPage = lazy(() => import('../pages/subscription/SubscriptionCheckoutPage').then(module => ({ default: module.SubscriptionCheckoutPage })));
const SubscriptionManagementPage = lazy(() => import('../pages/subscription/SubscriptionManagementPage').then(module => ({ default: module.SubscriptionManagementPage })));
const SuperadminLayout = lazy(() => import('../layouts/SuperadminLayout').then(module => ({ default: module.SuperadminLayout })));
const SuperadminDashboard = lazy(() => import('../pages/superadmin/SuperadminDashboard').then(module => ({ default: module.SuperadminDashboard })));
const SuperadminGyms = lazy(() => import('../pages/superadmin/SuperadminGyms').then(module => ({ default: module.SuperadminGyms })));
const SuperadminUsers = lazy(() => import('../pages/superadmin/SuperadminUsers').then(module => ({ default: module.SuperadminUsers })));
const SuperadminAudit = lazy(() => import('../pages/superadmin/SuperadminAudit').then(module => ({ default: module.SuperadminAudit })));
const SuperadminPlans = lazy(() => import('../pages/superadmin/SuperadminPlans').then(module => ({ default: module.SuperadminPlans })));
const SuperadminSubscriptions = lazy(() => import('../pages/superadmin/SuperadminSubscriptions').then(module => ({ default: module.SuperadminSubscriptions })));
const CreditsPage = lazy(() => import('../pages/credits/CreditsPage').then(module => ({ default: module.CreditsPage })));
const CashRegisterPage = lazy(() => import('../pages/cash_registers/CashRegisterPage').then(module => ({ default: module.CashRegisterPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage').then(module => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(module => ({ default: module.TermsPage })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg-screen">
    <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
  </div>
);

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<AppLayout />}>
          {/* Settings always accessible inside AppLayout so OWNER can see subscription */}
          <Route path="/settings" element={<GymSettingsPage />} />
          <Route path="/settings/subscription" element={<SubscriptionManagementPage />} />
          <Route path="/subscription/checkout" element={<SubscriptionCheckoutPage />} />
          
          {/* Protected operational routes */}
          <Route element={<SubscriptionGuard />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/memberships" element={<MembershipsPage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/cash-registers" element={<CashRegisterPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>

        {/* Demo Routes */}
        {/* Structure: DemoLayout (mock auth + banner) → AppLayout (sidebar/navbar) → Page */}
        <Route path="/demo" element={<DemoLayout />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/demo/dashboard" replace />} />
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
          </Route>
        </Route>

        <Route path="/superadmin" element={<SuperadminLayout />}>
          <Route index element={<SuperadminDashboard />} />
          <Route path="gyms" element={<SuperadminGyms />} />
          <Route path="users" element={<SuperadminUsers />} />
          <Route path="plans" element={<SuperadminPlans />} />
          <Route path="subscriptions" element={<SuperadminSubscriptions />} />
          <Route path="audit" element={<SuperadminAudit />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
