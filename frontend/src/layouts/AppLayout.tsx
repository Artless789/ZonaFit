import { useState, type CSSProperties } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/shared/Spinner';

export function AppLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 80 : 280;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role.toUpperCase() === 'SUPERADMIN') {
    return <Navigate to="/superadmin" replace />;
  }

  if (user && !user.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-transparent relative z-10">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div
        className="app-content flex min-h-screen min-w-0 flex-col transition-[padding] duration-300"
        style={{
          paddingLeft: sidebarWidth,
          '--app-sidebar-width': `${sidebarWidth}px`,
        } as CSSProperties}
      >
        <Navbar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[var(--content-max-width)] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
