import { LogOut, Menu, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGymSettings } from '../../hooks/useGymSettings';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/memberships': 'Membresías',
  '/sales': 'Ventas (POS)',
  '/cash-registers': 'Caja',
  '/credits': 'Cuentas por cobrar',
  '/invoices': 'Comprobantes',
  '/notifications': 'Notificaciones',
  '/reports': 'Reportes',
  '/audit': 'Auditoría',
  '/settings': 'Configuración',
  '/superadmin': 'Overview',
  '/superadmin/gyms': 'Gimnasios',
  '/superadmin/users': 'Usuarios',
  '/superadmin/plans': 'Planes Comerciales',
  '/superadmin/subscriptions': 'Suscripciones',
  '/superadmin/audit': 'Auditoría Global',
};

interface NavbarProps {
  onOpenMobileMenu: () => void;
}

export function Navbar({ onOpenMobileMenu }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { query } = useGymSettings();

  const currentPath = location.pathname.replace(/\/demo/, '') || '/dashboard';
  const title = pageTitles[currentPath] ?? 'Dashboard';
  const isSuperadmin = user?.role?.toUpperCase() === 'SUPERADMIN';
  const brandPrefix = isSuperadmin ? 'Admin' : (query.data?.trade_name ? query.data.trade_name.split(' ')[0] : 'Merwil');

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'WM';

  return (
    <header
      className="liquid-glass sticky top-4 z-30 flex h-16 items-center gap-3 rounded-full pl-3 pr-2 md:pl-6"
      style={{ backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'rgba(8, 8, 10, 0.62)' }}
    >
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-full p-2 text-text-secondary hover:bg-white/10 hover:text-text-primary md:hidden cursor-pointer"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>

      <nav aria-label="Ruta" className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] sm:flex">
        <span className="text-text-muted">{brandPrefix}</span>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary">{title}</span>
      </nav>

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-full p-2.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary cursor-pointer"
        aria-label="Alternar tema"
        title="Alternar tema visual"
      >
        {theme === 'dark' ? <Sun className="size-[18px]" strokeWidth={1.6} /> : <Moon className="size-[18px]" strokeWidth={1.6} />}
      </button>

      {/* User profile pill */}
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-1 sm:pr-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-white/25 to-white/5 text-xs font-semibold">
          {initials}
        </span>
        <span className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-sm font-medium leading-none">{user?.full_name || 'Wilmer Moscote'}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{user?.role || 'Owner'}</span>
        </span>
      </div>

      {/* Logout button */}
      <button
        type="button"
        onClick={logout}
        className="hidden rounded-full p-2.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary sm:block cursor-pointer"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="size-[18px]" strokeWidth={1.6} />
      </button>
    </header>
  );
}
