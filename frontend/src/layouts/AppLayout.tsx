import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Banknote, Menu } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '@shared/ui/Spinner';
import { cn } from '@shared/utils/cn';

export function AppLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const getRoute = (path: string) => (isDemo ? `/demo${path}` : path);

  const sidebarWidth = isSidebarCollapsed ? 88 : 272;

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 6000);
    return () => {
      clearTimeout(timer);
      setTimedOut(false);
    };
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Spinner className="w-10 h-10 text-brand-primary" />
      </div>
    );
  }

  if (isLoading && timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
        <div className="max-w-md w-full p-6 rounded-[var(--radius-xl)] bg-surface-panel border border-border-light shadow-floating text-center flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-brand-primary" />
          <h3 className="text-base font-semibold text-text-primary">Validando sesión...</h3>
          <p className="text-xs text-text-secondary">
            La conexión está tardando más de lo habitual en responder.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-sm)] bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.assign('/login'); }}
              className="px-4 py-2 text-xs font-medium rounded-[var(--radius-sm)] border border-border-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
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

  const mobileNavItems = [
    { path: getRoute('/dashboard'), label: 'Inicio', icon: LayoutDashboard },
    { path: getRoute('/clients'), label: 'Clientes', icon: Users },
    { path: getRoute('/sales'), label: 'POS', icon: ShoppingCart },
    { path: getRoute('/cash-registers'), label: 'Caja', icon: Banknote },
  ];

  return (
    <div className="min-h-screen bg-transparent relative">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div
        className={cn(
          "app-content flex min-h-screen min-w-0 flex-col transition-[padding] duration-250 ease-out",
          "pl-0 md:pl-[var(--app-sidebar-width)]"
        )}
        style={{
          '--app-sidebar-width': `${sidebarWidth}px`,
        } as CSSProperties}
      >
        <Navbar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 p-3 sm:p-5 lg:p-7 pb-24 md:pb-8">
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

      {/* Floating Spatial Mobile Navigation Bar */}
      <nav 
        aria-label="Navegación móvil rápida"
        className="fixed bottom-3 inset-x-3 z-[var(--z-navbar)] md:hidden zonafit-navbar-surface rounded-full flex items-center justify-around py-1.5 px-3 shadow-floating border border-border-light"
      >
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all duration-150',
              isActive
                ? 'text-brand-primary font-semibold'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} className={isActive ? 'text-brand-primary' : 'text-text-muted'} />
                <span className="text-[0.625rem] mt-0.5 tracking-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Abrir menú completo"
        >
          <Menu size={19} />
          <span className="text-[0.625rem] mt-0.5 tracking-tight">Más</span>
        </button>
      </nav>
    </div>
  );
}
