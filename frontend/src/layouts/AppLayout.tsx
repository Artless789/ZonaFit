import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '@shared/ui/Spinner';

export function AppLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 80 : 280;

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  if (isLoading && timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
        <div className="max-w-md w-full p-6 rounded-2xl bg-bg-surface border border-border-subtle shadow-xl text-center flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-brand-primary" />
          <h3 className="text-lg font-bold text-text-primary">Validando sesión...</h3>
          <p className="text-sm text-text-secondary">
            La conexión está tardando más de lo habitual en responder.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-text-white hover:bg-brand-primary-hover transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.assign('/login'); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role.toUpperCase() === 'SUPERADMIN') {
    window.location.assign('/superadmin');
    return null;
  }

  if (user && !user.onboarding_completed) {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
      window.location.assign('/onboarding');
      return null;
    }
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
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[50vh]">
                <Spinner className="w-8 h-8 text-brand-primary" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
