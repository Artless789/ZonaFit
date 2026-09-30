import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Download,
  Lock,
  LogIn,
  Menu,
  MessageCircle,
  Play,
  Smartphone,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { formatCurrency } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isInstallable, isInstalled, platform, installPWA } = usePWAInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPwaPlatform, setSelectedPwaPlatform] = useState<'desktop' | 'android' | 'ios'>(
    platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop'
  );

  const defaultPlans = useMemo(() => {
    return [
      {
        id: 1,
        name: 'Plan Mensual',
        price: 65000,
        interval: 'MONTHLY',
        badge: 'Operación Básica',
        desc: 'Para gimnasios y centros deportivos que inician su digitalización sin compromisos de largo plazo.',
        popular: false,
        features: [
          'Clientes y membresías ilimitadas',
          'Punto de Venta (POS) y facturación PDF',
          'Arqueos de caja y control de turno',
          'Cobranza y alertas por WhatsApp Web',
          'Instalación PWA en móvil y desktop',
        ],
      },
      {
        id: 2,
        name: 'Plan Trimestral',
        price: 180000,
        interval: 'QUARTERLY',
        badge: 'Más Popular',
        desc: 'La opción recomendada para dueños que buscan estabilidad operativa y ahorro comprobado.',
        popular: true,
        features: [
          'Todo lo incluido en el Plan Mensual',
          'Soporte prioritario 7 días a la semana',
          'Módulo de Cuentas por Cobrar (CxC)',
          'Control de kardex y stock mínimo',
          'Reportes analíticos de retención y bajas',
          'Descuento del 10% sobre la tarifa mensual',
        ],
      },
      {
        id: 3,
        name: 'Plan Anual',
        price: 590000,
        interval: 'YEARLY',
        badge: 'Máximo Ahorro',
        desc: 'Compromiso de alto rendimiento con la mayor tasa de retorno para tu infraestructura deportiva.',
        popular: false,
        features: [
          'Todo lo del plan trimestral',
          'Ahorro equivalente a casi 3 meses gratis',
          'Capacitación inicial personalizada para tu equipo',
          'Respaldo prioritario en la nube',
          'Garantía de actualización continua',
        ],
      },
    ];
  }, []);

  const handleSelectPlan = (planId?: number) => {
    if (planId) {
      navigate(isAuthenticated ? `/subscription/checkout?planId=${planId}` : `/register?planId=${planId}`);
    } else {
      navigate(isAuthenticated ? '/subscription/checkout' : '/register');
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await installPWA();
    } else if (isInstalled) {
      window.location.assign('/app/dashboard');
    } else {
      document.getElementById('pwa-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-[#F3F4F6] font-sans selection:bg-[#DC2626] selection:text-white">
      {/* Background Subtle Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-[#DC2626]/12 to-transparent blur-[140px] opacity-70" />
        <div className="absolute top-[35%] -right-40 w-[600px] h-[600px] bg-[#32292F]/20 blur-[160px] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
      </div>

      {/* ========================================================
          01 — NAVBAR EDITORIAL
         ======================================================== */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#020202]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <img
                src="/logo.png"
                alt="Merwil ZonaFit"
                className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(220,38,38,0.5)]"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-extrabold tracking-widest text-white uppercase flex items-center gap-2">
                MERWIL ZONAFIT
              </span>
              <span className="text-[10px] font-mono text-neutral-400 tracking-wider">SISTEMA DE GESTIÓN OPERATIVA</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-neutral-300">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#metrics" className="hover:text-white transition-colors">Rendimiento</a>
            <a href="#comparativa" className="hover:text-white transition-colors">Comparativa</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#pwa" className="hover:text-white transition-colors">App PWA</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate('/demo')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.05] rounded-full transition-colors cursor-pointer border border-transparent hover:border-white/10"
            >
              <Play size={13} className="text-[#DC2626]" />
              <span>Ver Demo</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold text-neutral-200 hover:text-white bg-[#171717] hover:bg-[#1D1D1D] border border-white/10 rounded-full transition-colors cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => handleSelectPlan()}
              className="px-5 py-2 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#EF4444] rounded-full transition-all shadow-md shadow-[#DC2626]/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Probar Gratis 14 Días
            </button>
          </div>

          {/* Mobile Hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => handleSelectPlan()}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#DC2626] rounded-full shadow-sm"
            >
              Probar Gratis
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-neutral-300 hover:text-white bg-[#171717] rounded-xl border border-white/10"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 py-5 bg-[#020202] border-b border-white/10 flex flex-col gap-3 text-xs font-semibold">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-neutral-300 hover:text-white">Funcionalidades</a>
            <a href="#metrics" onClick={() => setMobileMenuOpen(false)} className="py-2 text-neutral-300 hover:text-white">Rendimiento</a>
            <a href="#comparativa" onClick={() => setMobileMenuOpen(false)} className="py-2 text-neutral-300 hover:text-white">Comparativa</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-neutral-300 hover:text-white">Precios</a>
            <a href="#pwa" onClick={() => setMobileMenuOpen(false)} className="py-2 text-neutral-300 hover:text-white">App Móvil (PWA)</a>
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/demo'); }}
                className="w-full py-2.5 rounded-xl bg-[#171717] text-white flex items-center justify-center gap-2"
              >
                <Play size={14} className="text-[#DC2626]" />
                <span>Explorar Demo</span>
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                className="w-full py-2.5 rounded-xl bg-[#171717] text-white flex items-center justify-center gap-2"
              >
                <LogIn size={14} />
                <span>Iniciar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================
          02 — HERO SECTION (BRUTALIST EDITORIAL)
         ======================================================== */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#171717] border border-white/10 text-neutral-300 font-mono text-[11px] uppercase tracking-wider mb-6">
            <span className="size-2 rounded-full bg-[#DC2626] animate-pulse" />
            <span>SOFTWARE DE GESTIÓN PARA GIMNASIOS DE ALTO RENDIMIENTO</span>
          </div>

          {/* Brutal Impact H1 */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-0.04em] uppercase text-white leading-[0.96] max-w-5xl">
            EL CONTROL DE TU GIMNASIO,{' '}
            <span className="inline-block bg-[#DC2626] text-white px-3 sm:px-5 py-0.5 sm:py-1 rounded-sm shadow-[0_0_30px_rgba(220,38,38,0.35)] align-baseline">
              SIN EL CAOS.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-7 text-base sm:text-lg md:text-xl text-neutral-300 max-w-3xl leading-relaxed">
            Controla membresías con renovación continua, POS en mostrador en tiempo real, corte de caja al centavo y retención directa por WhatsApp. Diseñado para dueños de gimnasios que exigen precisión absoluta.
          </p>

          {/* Trust Badges */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3 sm:gap-6 text-xs text-neutral-400 font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#DC2626]" />
              14 Días Gratis
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#DC2626]" />
              Sin Tarjeta Requerida
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#DC2626]" />
              Cero Contratos Forzosos
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#DC2626]" />
              Offline-Ready & PWA
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => handleSelectPlan()}
              className="w-full sm:w-auto px-8 py-4 text-sm font-extrabold uppercase tracking-wider text-white bg-[#DC2626] hover:bg-[#EF4444] rounded-full transition-all shadow-[0_0_35px_rgba(220,38,38,0.45)] hover:scale-105 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            >
              <span>Iniciar Prueba Gratuita</span>
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto px-7 py-4 text-sm font-semibold text-white bg-[#171717] hover:bg-[#1D1D1D] border border-white/15 rounded-full transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play size={15} className="text-[#DC2626]" />
              <span>Ver Demostración Operativa</span>
            </button>
          </div>

          {/* Cinematic Showcase Container */}
          <div className="mt-14 w-full max-w-6xl relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.9)] bg-[#171717]">
              {/* Cinematic Gym Background Image */}
              <div className="relative h-[320px] sm:h-[480px] lg:h-[580px] w-full overflow-hidden">
                <img
                  src="/images/cinematic-gym.png"
                  alt="Merwil ZonaFit Cinematic Environment"
                  className="w-full h-full object-cover opacity-75 scale-105 transition-transform duration-700 hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#020202]/70 via-transparent to-[#020202]/70" />

                {/* Live Mockup Overlay Card */}
                <div className="absolute inset-x-4 bottom-4 sm:inset-x-8 sm:bottom-8 lg:inset-x-12 lg:bottom-12 p-5 sm:p-7 rounded-2xl bg-[#020202]/90 backdrop-blur-2xl border border-white/15 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                      <div>
                        <div className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          CENTRO DE OPERACIONES EN VIVO
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Turno activo · Arqueo conciliado al centavo
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] font-bold">
                        Caja Abierta
                      </span>
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                        334 Clientes Activos
                      </span>
                    </div>
                  </div>

                  {/* 3 Metric Previews */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                    <div className="p-3.5 rounded-xl bg-[#171717] border border-white/5 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400">Ingresos del Mes</span>
                      <span className="text-xl sm:text-2xl font-light font-mono text-white">$2.503.000 COP</span>
                      <span className="text-[10px] text-[#22C55E] font-mono font-bold">+12.4% vs mes previo</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#171717] border border-white/5 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400">Ventas Mostrador (POS)</span>
                      <span className="text-xl sm:text-2xl font-light font-mono text-white">$71.000 COP</span>
                      <span className="text-[10px] text-neutral-400 font-mono">14 ventas rápidas hoy</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#171717] border border-white/5 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400">Retención por WhatsApp</span>
                      <span className="text-xl sm:text-2xl font-light font-mono text-white">4 por vencer</span>
                      <span className="text-[10px] text-[#DC2626] font-mono font-bold">1 toque para contactar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          03 — SOCIAL PROOF / METRICS BAND
         ======================================================== */}
      <section id="metrics" className="py-12 border-y border-white/10 bg-[#171717]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col gap-1">
              <span className="text-3xl sm:text-5xl font-black font-mono text-[#DC2626] tracking-tight">+98.4%</span>
              <span className="text-xs sm:text-sm font-semibold text-white">Precisión en Arqueos</span>
              <span className="text-[11px] text-neutral-400">Cero descuadres entre efectivo y sistemas</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl sm:text-5xl font-black font-mono text-white tracking-tight">3x</span>
              <span className="text-xs sm:text-sm font-semibold text-white">Más Rápido en Cobros</span>
              <span className="text-[11px] text-neutral-400">Recordatorios con 1 clic por WhatsApp</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl sm:text-5xl font-black font-mono text-[#22C55E] tracking-tight">0%</span>
              <span className="text-xs sm:text-sm font-semibold text-white">Pérdida en Cartera</span>
              <span className="text-[11px] text-neutral-400">Cuentas por cobrar con balance auditado</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl sm:text-5xl font-black font-mono text-white tracking-tight">100%</span>
              <span className="text-xs sm:text-sm font-semibold text-white">Multi-Dispositivo</span>
              <span className="text-[11px] text-neutral-400">Funciona en PC, tablet o celular como PWA</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          04 — BENTO GRID DE CAPACIDADES PRINCIPALES
         ======================================================== */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center text-center mb-16">
          <p className="font-mono text-xs uppercase tracking-widest text-[#DC2626] font-bold">
            ARQUITECTURA DE CONTROL
          </p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight uppercase text-white">
            POTENCIA OPERATIVA EN CADA MÓDULO.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl">
            Herramientas construidas específicamente para resolver las fugas de dinero, el desorden de membresías y la lentitud en mostrador.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: POS */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center text-[#DC2626] group-hover:scale-110 transition-transform">
                <Coins size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Punto de Venta (POS) Instantáneo</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Factura suplementos, bebidas y accesorios en segundos. Soporta venta de contado, pagos mixtos y venta a crédito vinculada directamente a la ficha del socio.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Tickets PDF automáticos</span>
            </div>
          </div>

          {/* Card 2: Caja */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-[#22C55E] group-hover:scale-110 transition-transform">
                <Lock size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Arqueos y Cierres al Centavo</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Control ciego de turno por cajero. Separa en tiempo real lo recibido en efectivo, transferencias bancarias y tarjetas, impidiendo fugas silenciosas de dinero.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Auditoría inmutable por turno</span>
            </div>
          </div>

          {/* Card 3: Membresías */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Users size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Membresías con Cobertura Continua</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Al renovar a un cliente activo, el sistema extiende automáticamente la fecha de corte sin quitarle los días que aún le quedaban. Cero reclamos de clientes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Cálculo matemático de vigencias</span>
            </div>
          </div>

          {/* Card 4: WhatsApp */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-[#22C55E] group-hover:scale-110 transition-transform">
                <MessageCircle size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Cobranza y Alertas por WhatsApp</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Envía recordatorios de vencimiento y cobros de saldos pendientes con un clic, con mensajes profesionales listos para enviar al WhatsApp del cliente.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Sin costos de mensajes SMS</span>
            </div>
          </div>

          {/* Card 5: CxC */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <WalletCards size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Cartera Activa vs Historial</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Separación estricta de deudas vigentes e historial de cuentas pagadas. Cuando una cuenta queda en $0, sale automáticamente de tu cartera activa.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Abonos parciales con recibo</span>
            </div>
          </div>

          {/* Card 6: PWA */}
          <div className="p-7 rounded-2xl bg-[#171717] border border-white/10 hover:border-[#DC2626]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center text-[#DC2626] group-hover:scale-110 transition-transform">
                <Smartphone size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">PWA Móvil y Escritorio</h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                Instálalo directamente en tu celular, tablet o laptop. Sin pasar por App Store ni Google Play. Carga ultra veloz y funcionamiento en red local.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <CheckCircle2 size={13} className="text-[#22C55E]" />
              <span>Instalación instantánea 1-click</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          05 — COMPARATIVA DE MERCADO
         ======================================================== */}
      <section id="comparativa" className="py-20 border-y border-white/10 bg-[#171717]/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="font-mono text-xs uppercase tracking-widest text-[#DC2626] font-bold">
              ANÁLISIS COMPARATIVO
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black uppercase text-white">
              ¿POR QUÉ LOS GIMNASIOS CAMBIAN A ZONAFIT?
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#020202]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#171717]/80 font-mono text-xs uppercase">
                  <th className="p-4 sm:p-5 text-neutral-400">Aspecto Crítico</th>
                  <th className="p-4 sm:p-5 text-neutral-400">Excel / Cuaderno / Antiguo</th>
                  <th className="p-4 sm:p-5 text-[#DC2626] font-bold">Merwil ZonaFit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Control de Caja</td>
                  <td className="p-4 sm:p-5 text-neutral-400">Descuadres frecuentes, dinero sin registrar</td>
                  <td className="p-4 sm:p-5 text-[#22C55E] font-medium">Arqueo ciego auditado al centavo</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Vencimiento de Planes</td>
                  <td className="p-4 sm:p-5 text-neutral-400">Clientes entrenan gratis por semanas</td>
                  <td className="p-4 sm:p-5 text-[#22C55E] font-medium">Alerta automática y recordatorio WhatsApp</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Velocidad en Mostrador</td>
                  <td className="p-4 sm:p-5 text-neutral-400">3 a 5 minutos por cliente</td>
                  <td className="p-4 sm:p-5 text-[#22C55E] font-medium">Menos de 15 segundos por ticket POS</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Cuentas por Cobrar</td>
                  <td className="p-4 sm:p-5 text-neutral-400">Anotadas en papeles que se extravían</td>
                  <td className="p-4 sm:p-5 text-[#22C55E] font-medium">Cartera activa vs saldada en tiempo real</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Movilidad</td>
                  <td className="p-4 sm:p-5 text-neutral-400">Atado al computador viejo de la recepción</td>
                  <td className="p-4 sm:p-5 text-[#22C55E] font-medium">PWA en tu bolsillo, tablet o laptop</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================
          06 — PRICING CARDS
         ======================================================== */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center text-center mb-16">
          <p className="font-mono text-xs uppercase tracking-widest text-[#DC2626] font-bold">
            PLANES CLAROS Y TRANSPARENTES
          </p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight uppercase text-white">
            INVIERTE EN CONTROL Y RETENCIÓN.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl">
            Sin costos ocultos, sin comisiones por socio y sin contratos atados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {defaultPlans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-3xl p-8 flex flex-col justify-between transition-all relative',
                plan.popular
                  ? 'bg-[#171717] border-2 border-[#DC2626] shadow-[0_0_40px_rgba(220,38,38,0.25)] scale-105 z-10'
                  : 'bg-[#171717]/60 border border-white/10 hover:border-white/20'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#DC2626] text-white text-[11px] font-mono uppercase tracking-wider font-extrabold shadow-md">
                  {plan.badge}
                </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-neutral-400 mt-1">{plan.desc}</p>
                  </div>
                </div>

                <div className="my-6">
                  <span className="text-4xl font-extrabold font-mono text-white">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-xs text-neutral-400 ml-2 font-mono">COP</span>
                </div>

                <ul className="space-y-3 pt-4 border-t border-white/10">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-300">
                      <CheckCircle2 size={15} className="text-[#DC2626] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={cn(
                    'w-full py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2',
                    plan.popular
                      ? 'bg-[#DC2626] hover:bg-[#EF4444] text-white shadow-lg shadow-[#DC2626]/40 hover:scale-[1.02]'
                      : 'bg-[#020202] hover:bg-[#1D1D1D] text-white border border-white/15'
                  )}
                >
                  <span>Seleccionar Plan</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          07 — PWA INSTALL GUIDE SECTION
         ======================================================== */}
      <section id="pwa" className="py-20 border-t border-white/10 bg-[#171717]/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171717] border border-white/10 text-neutral-400 font-mono text-xs uppercase mb-4">
            <Smartphone size={14} className="text-[#DC2626]" />
            <span>PROGRESSIVE WEB APP</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight">
            INSTÁLALO EN CUALQUIER DISPOSITIVO EN 10 SEGUNDOS
          </h2>
          <p className="mt-3 text-sm text-neutral-400 max-w-xl mx-auto">
            Disfruta de una experiencia idéntica a una aplicación nativa sin consumir memoria pesada y con acceso directo desde tu pantalla principal.
          </p>

          {/* Platform Switcher */}
          <div className="mt-8 flex justify-center gap-2 p-1 rounded-full bg-[#020202] border border-white/10 w-fit mx-auto">
            <button
              onClick={() => setSelectedPwaPlatform('desktop')}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                selectedPwaPlatform === 'desktop' ? 'bg-[#171717] text-white border border-white/10' : 'text-neutral-400 hover:text-white'
              )}
            >
              PC / Mac (Chrome/Edge)
            </button>
            <button
              onClick={() => setSelectedPwaPlatform('android')}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                selectedPwaPlatform === 'android' ? 'bg-[#171717] text-white border border-white/10' : 'text-neutral-400 hover:text-white'
              )}
            >
              Android
            </button>
            <button
              onClick={() => setSelectedPwaPlatform('ios')}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                selectedPwaPlatform === 'ios' ? 'bg-[#171717] text-white border border-white/10' : 'text-neutral-400 hover:text-white'
              )}
            >
              iPhone / iPad (iOS)
            </button>
          </div>

          {/* Guide Content */}
          <div className="mt-8 p-6 rounded-2xl bg-[#020202] border border-white/10 text-left max-w-xl mx-auto text-xs leading-relaxed text-neutral-300 space-y-3 font-mono">
            {selectedPwaPlatform === 'desktop' && (
              <>
                <p>1. Abre este sitio en Google Chrome o Microsoft Edge.</p>
                <p>2. Haz clic en el icono de instalación (pantalla con flecha) ubicado en la barra de direcciones.</p>
                <p>3. Haz clic en "Instalar Merwil ZonaFit" para tener la app en tu escritorio.</p>
              </>
            )}
            {selectedPwaPlatform === 'android' && (
              <>
                <p>1. Abre este sitio en Google Chrome desde tu teléfono Android.</p>
                <p>2. Toca el botón "Instalar Aplicación" abajo o toca los 3 puntos de Chrome.</p>
                <p>3. Selecciona "Añadir a la pantalla de inicio" o "Instalar aplicación".</p>
              </>
            )}
            {selectedPwaPlatform === 'ios' && (
              <>
                <p>1. Abre este enlace en el navegador Safari de tu iPhone o iPad.</p>
                <p>2. Toca el botón Compartir (el cuadrado con la flecha hacia arriba).</p>
                <p>3. Desplázate hacia abajo y selecciona "Añadir a la pantalla de inicio".</p>
              </>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={handleInstallClick}
              className="px-7 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#171717] hover:bg-[#1D1D1D] border border-white/20 rounded-full transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Download size={14} className="text-[#DC2626]" />
              <span>{isInstalled ? 'App ya instalada (Abrir)' : 'Instalar Merwil ZonaFit PWA'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          08 — FINAL CTA & FOOTER EDITORIAL
         ======================================================== */}
      <section className="py-24 border-t border-white/10 relative overflow-hidden bg-gradient-to-b from-[#020202] via-[#171717]/80 to-[#020202]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-7">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase text-white tracking-tight leading-none">
            EMPIEZA HOY MISMO A TRANSFORMAR TU GIMNASIO.
          </h2>
          <p className="text-sm sm:text-base text-neutral-300 max-w-xl mx-auto">
            Configuración en 3 minutos. Sin contratos obligatorios. Prueba la versión completa durante 14 días sin costo.
          </p>
          <div>
            <button
              onClick={() => handleSelectPlan()}
              className="px-9 py-4 text-sm font-extrabold uppercase tracking-wider text-white bg-[#DC2626] hover:bg-[#EF4444] rounded-full transition-all shadow-[0_0_40px_rgba(220,38,38,0.5)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              Comenzar Prueba Gratuita de 14 Días
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-[#020202] text-neutral-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            {/* Col 1: Brand */}
            <div className="md:col-span-1 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Merwil ZonaFit" className="w-7 h-7 object-contain" />
                <span className="font-mono font-bold text-white tracking-wider">MERWIL ZONAFIT</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Sistema de gestión operativa de alto rendimiento para gimnasios y centros deportivos.
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 mt-1">
                <span className="size-2 rounded-full bg-[#22C55E]" />
                <span>Sistemas operativos en línea · Colombia</span>
              </div>
            </div>

            {/* Col 2: Plataforma */}
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-xs uppercase tracking-wider text-white font-bold">Plataforma</span>
              <a href="#features" className="hover:text-white transition-colors text-neutral-400">Funcionalidades</a>
              <a href="#metrics" className="hover:text-white transition-colors text-neutral-400">Rendimiento</a>
              <a href="#comparativa" className="hover:text-white transition-colors text-neutral-400">Comparativa</a>
              <a href="#pricing" className="hover:text-white transition-colors text-neutral-400">Planes y Precios</a>
            </div>

            {/* Col 3: Acceso y Recursos */}
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-xs uppercase tracking-wider text-white font-bold">Acceso</span>
              <button onClick={() => navigate('/demo')} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">Demo Interactiva</button>
              <button onClick={() => navigate('/login')} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">Iniciar Sesión</button>
              <button onClick={() => handleSelectPlan()} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">Crear Cuenta (Trial 14d)</button>
              <a href="mailto:soporte@merwilzonafit.com" className="hover:text-white transition-colors text-neutral-400">Contacto y Soporte</a>
            </div>

            {/* Col 4: Legal & Cumplimiento */}
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-xs uppercase tracking-wider text-white font-bold">Legal</span>
              <button onClick={() => navigate('/terms')} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">
                Términos y Condiciones
              </button>
              <button onClick={() => navigate('/privacy')} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">
                Política de Privacidad
              </button>
              <button onClick={() => navigate('/data-deletion')} className="text-left hover:text-white transition-colors text-neutral-400 cursor-pointer">
                Tratamiento y Supresión de Datos
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-neutral-500 font-mono text-[11px]">
            <div>
              © {new Date().getFullYear()} Merwil ZonaFit. Todos los derechos reservados.
            </div>
            <div>
              Software como Servicio (SaaS) regulado bajo las leyes de la República de Colombia.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
