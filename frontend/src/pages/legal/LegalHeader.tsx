import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Trash2 } from 'lucide-react';

export function LegalHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      path: '/terms',
      label: 'Términos y Condiciones',
      icon: FileText,
    },
    {
      path: '/privacy',
      label: 'Política de Privacidad',
      icon: ShieldCheck,
    },
    {
      path: '/data-deletion',
      label: 'Eliminación de Datos',
      icon: Trash2,
    },
  ];

  return (
    <header className="w-full border-b border-border-light/60 bg-bg-surface/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-text-primary hover:text-brand-primary transition-colors group cursor-pointer"
            title="Ir al inicio"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center p-1.5 transition-transform group-hover:scale-105">
              <img src="/logo.png" alt="Merwil ZonaFit" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-text-primary">
              MERWIL <span className="text-brand-primary">ZONAFIT</span>
            </span>
          </button>
        </div>

        {/* Navigation tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-bg-elevated/70 border border-border-medium rounded-full p-1 shadow-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-glass-overlay'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Back button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary px-3 py-1.5 rounded-lg border border-border-medium hover:border-border-strong hover:bg-glass-overlay transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Volver al inicio</span>
            <span className="sm:hidden">Inicio</span>
          </button>
        </div>
      </div>

      {/* Mobile nav tabs */}
      <div className="md:hidden flex items-center justify-around border-t border-border-light/40 px-2 py-1.5 bg-bg-surface/95 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.7rem] font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={12} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
