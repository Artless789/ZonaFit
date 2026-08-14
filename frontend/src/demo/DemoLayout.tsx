import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MOCK_USER } from './mockData';
import { activateDemoMode, deactivateDemoMode } from './demoInterceptor';
import { queryClient } from '../main';

export function DemoLayout() {
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Activate demo mode (sets localStorage flag)
    activateDemoMode();

    // 2. Clear React Query cache so no real data leaks into demo
    //    and no demo data bleeds out after unmount.
    queryClient.clear();

    // 3. Ready to render mock UI
    setIsReady(true);

    return () => {
      // Cleanup on unmount: remove demo mode flag and purge demo cache.
      // This runs when the user navigates away from /demo/* entirely.
      deactivateDemoMode();
      queryClient.clear();
    };
  }, []);

  if (!isReady) return null;

  // ── Mock AuthContext ────────────────────────────────────────────────────────
  // This context is scoped ONLY to the <DemoLayout> subtree.
  // It never touches localStorage 'token', never calls real auth endpoints,
  // and is completely destroyed when DemoLayout unmounts.
  const mockAuthContext = {
    user: MOCK_USER as any,
    isAuthenticated: true,
    isLoading: false,
    login: async () => MOCK_USER as any,
    logout: () => {
      // Exit demo → go to landing page
      navigate('/', { replace: true });
    },
  };

  return (
    <AuthContext.Provider value={mockAuthContext}>
      {/* ── Demo Banner ────────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-10 bg-brand-primary flex flex-wrap items-center justify-center text-white text-xs sm:text-sm px-4 shadow-md">
        <span className="truncate">
          Estás explorando ZonaFit Demo. Los cambios realizados aquí no se
          guardarán.
        </span>
        <Link
          to="/register"
          className="ml-2 sm:ml-4 font-bold bg-white text-brand-primary px-3 py-1 rounded-full text-xs hover:bg-bg-surface transition-colors shrink-0"
        >
          Crear mi gimnasio gratis
        </Link>
      </div>

      {/* ── Demo Content ───────────────────────────────────────────────────── */}
      {/* pt-10 pushes content below the fixed banner */}
      <div className="pt-10">
        {/* Outlet renders the matched child route (e.g. /demo/dashboard → DashboardPage) */}
        <Outlet />
      </div>
    </AuthContext.Provider>
  );
}
