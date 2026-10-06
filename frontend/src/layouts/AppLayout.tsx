import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Banknote, Menu } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Spinner } from '@shared/ui/Spinner';
import { cn } from '@shared/utils/cn';

export function AppLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const getRoute = (path: string) => (isDemo ? `/demo${path}` : path);

  // Desktop sidebar floating offset: width (84px or 264px) + outer margin (12px) + content gutter (8px)
  const sidebarOffset = isSidebarCollapsed ? 104 : 284;

  // Session timeout detection
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

  // Keyboard accessibility: Close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Scroll locking: Prevent body background scrolling when mobile sidebar is open
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const prevCount = Number(document.body.dataset.scrollLockCount || '0');
    document.body.dataset.scrollLockCount = String(prevCount + 1);
    document.body.style.overflow = 'hidden';

    return () => {
      const currentCount = Number(document.body.dataset.scrollLockCount || '1');
      const nextCount = Math.max(0, currentCount - 1);
      if (nextCount === 0) {
        delete document.body.dataset.scrollLockCount;
        document.body.style.overflow = '';
      } else {
        document.body.dataset.scrollLockCount = String(nextCount);
      }
    };
  }, [isMobileSidebarOpen]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <Spinner className="w-10 h-10 text-brand-primary" />
      </div>
    );
  }

  if (isLoading && timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
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
    <div className="relative min-h-dvh overflow-x-clip bg-surface-base text-text-primary selection:bg-brand-primary/20 selection:text-white">
      {/* 1. Ambient Cinematic Atmosphere Layer (Reference 1:1 app-shell.tsx) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {isLight ? (
          <>
            <img
              src="/images/cinematic-gym-light.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#f6f6f8]/50 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#f6f6f8] via-[#f6f6f8]/10 to-transparent" />
            <div className="cinematic-grid absolute inset-0" />
            <div className="cinematic-grain absolute inset-0" />
          </>
        ) : (
          <>
            <img
              src="/images/cinematic-gym.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-right opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="cinematic-grid absolute inset-0" />
            <div className="cinematic-grain absolute inset-0" />
          </>
        )}
      </div>

      {/* 2. Floating Spatial Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
      />

      {/* 3. Main Application Content Area (Reference 1:1 Layout) */}
      <div
        className={cn(
          "relative z-10 flex min-h-screen min-w-0 flex-col transition-[padding] duration-250 ease-out",
          "pl-0 md:pl-[var(--app-sidebar-offset)]"
        )}
        style={{
          '--app-sidebar-offset': `${sidebarOffset}px`,
        } as CSSProperties}
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6 px-3.5 sm:px-4 pb-24 md:pb-16 pt-3 sm:pt-4 md:px-8">
          <Navbar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />
          <main className="min-w-0">
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

      {/* 4. Floating Spatial Mobile Quick Navigation Bar */}
      <nav
        aria-label="Navegación móvil rápida"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] inset-x-3 z-[var(--z-navbar)] md:hidden liquid-glass rounded-full flex items-center justify-around py-1.5 px-2 shadow-floating border border-border-light select-none"
      >
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-150 min-w-[54px] min-h-[44px] touch-manipulation',
              isActive
                ? 'text-brand-primary font-semibold'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} className={isActive ? 'text-brand-primary' : 'text-text-muted'} />
                <span className="text-[0.625rem] mt-0.5 tracking-tight font-medium">{item.label}</span>
                {isActive && (
                  <span
                    className="size-1 rounded-full bg-brand-primary mt-0.5 shadow-[0_0_6px_rgba(220,38,38,0.7)]"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
          aria-expanded={isMobileSidebarOpen}
          className="flex flex-col items-center justify-center py-1 px-2.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer min-w-[54px] min-h-[44px] touch-manipulation"
          aria-label="Abrir menú completo"
        >
          <Menu size={19} />
          <span className="text-[0.625rem] mt-0.5 tracking-tight font-medium">Más</span>
        </button>
      </nav>
    </div>
  );
}
