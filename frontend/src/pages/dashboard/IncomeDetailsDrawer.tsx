import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from '@shared/ui/Drawer';
import { Button } from '@shared/ui/Button';
import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';
import { dashboardService } from '../../services/dashboardService';
import {
  CircleDollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Sparkles,
  Info,
  ArrowRight,
  ClipboardList,
  ShoppingCart,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  X,
} from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface IncomeDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IncomeDetailsDrawer({ isOpen, onClose }: IncomeDetailsDrawerProps) {
  const navigate = useNavigate();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [paymentPage, setPaymentPage] = useState<number>(1);
  const paymentPageSize = 10;
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  const selectMonthAndYear = (month: number, year: number) => {
    setSelectedDay(null);
    setSelectedMonth(month);
    setSelectedYear(year);
    setPaymentPage(1);
    setPaymentMethodFilter('ALL');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    if (isMonthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthDropdownOpen]);

  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;

  // Opciones de los últimos 24 meses para navegación directa
  const monthOptions = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      return {
        month: m,
        year: y,
        key: `${y}-${m}`,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        isCurrent: m === currentMonth && y === currentYear,
      };
    });
  }, [currentMonth, currentYear]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      selectMonthAndYear(12, selectedYear - 1);
    } else {
      selectMonthAndYear(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) {
      selectMonthAndYear(1, selectedYear + 1);
    } else {
      selectMonthAndYear(selectedMonth + 1, selectedYear);
    }
  };

  const handleResetCurrentMonth = () => {
    selectMonthAndYear(currentMonth, currentYear);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['incomeDetails', selectedMonth, selectedYear],
    queryFn: () => dashboardService.getIncomeDetails(selectedMonth, selectedYear),
    enabled: isOpen,
    staleTime: 1000 * 60 * 2,
  });

  const getConceptIcon = (concept: string) => {
    switch (concept) {
      case 'MEMBERSHIP':
        return <ClipboardList size={18} className="text-info" />;
      case 'SALE':
        return <ShoppingCart size={18} className="text-brand-primary" />;
      case 'RECEIVABLE':
        return <Wallet size={18} className="text-success" />;
      default:
        return <CircleDollarSign size={18} className="text-text-muted" />;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toUpperCase()) {
      case 'CASH':
        return <Banknote size={18} className="text-success" />;
      case 'TRANSFER':
        return <Smartphone size={18} className="text-info" />;
      case 'CARD':
        return <CreditCard size={18} className="text-warning" />;
      default:
        return <CircleDollarSign size={18} className="text-text-muted" />;
    }
  };

  const highestAmount = data?.highest_day ? Number(data.highest_day.amount) : 0;

  const handleDayClick = (day: number) => {
    if (selectedDay === day) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  const selectedDayData = selectedDay && data?.daily_history
    ? data.daily_history.find((d) => d.day === selectedDay)
    : null;

  const dayPayments = selectedDay && data?.recent_payments
    ? data.recent_payments.filter((p) => p.day === selectedDay)
    : [];

  // Lista dinámica de métodos de pago disponibles en las transacciones del mes
  const paymentMethodsList = useMemo(() => {
    if (!data?.recent_payments) return [];
    const map = new Map<string, { code: string; label: string; count: number }>();
    data.recent_payments.forEach((p) => {
      const code = (p.payment_method || 'OTHER').toUpperCase();
      const label = p.payment_method_label || code;
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(code, { code, label, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [data]);

  // Transacciones filtradas por método de pago y ordenadas por más recientes
  const filteredPayments = useMemo(() => {
    if (!data?.recent_payments) return [];
    let list = data.recent_payments;

    if (paymentMethodFilter !== 'ALL') {
      list = list.filter((p) => (p.payment_method || 'OTHER').toUpperCase() === paymentMethodFilter);
    }

    // Ordenar explícitamente por más recientes (created_at desc)
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [data, paymentMethodFilter]);

  const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const currentPaymentPage = Math.min(paymentPage, totalPaymentPages);

  const paginatedPayments = useMemo(() => {
    const start = (currentPaymentPage - 1) * paymentPageSize;
    return filteredPayments.slice(start, start + paymentPageSize);
  }, [filteredPayments, currentPaymentPage, paymentPageSize]);

  const handlePaymentMethodFilterChange = (method: string) => {
    setPaymentMethodFilter(method);
    setPaymentPage(1);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Análisis Detallado de Ingresos"
    >
      <div className="space-y-6 text-text-primary pb-8">
        {/* Header contextual con Selector de Meses */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-light">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isCurrentMonth
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-info/10 text-info border-info/20'
              }`}>
                {data?.month_name || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
              </span>
              <span className="text-xs text-text-muted">
                {isCurrentMonth ? 'Corte en tiempo real' : 'Histórico cerrado'}
              </span>
            </div>
            <h3 className="text-xl font-bold mt-1.5 text-text-primary">
              Rendimiento Financiero Mensual
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Desglose detallado de todos los pagos efectivamente recaudados durante el mes.
            </p>
          </div>

          {/* Navegador de Meses con Dropdown Liquid Glass */}
          <div className="flex items-center gap-1.5 bg-bg-surface/80 border border-border-light p-1.5 rounded-xl self-start sm:self-auto shadow-sm">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Mes anterior"
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border-light transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Custom Dropdown Trigger & Popover */}
            <div className="relative" ref={monthDropdownRef}>
              <button
                type="button"
                onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary transition-all duration-200",
                  "bg-bg-surface hover:bg-surface-light border border-border-light/80 hover:border-border-medium shadow-xs",
                  isMonthDropdownOpen && "border-brand-primary ring-2 ring-brand-primary/20 bg-bg-surface-hover"
                )}
              >
                <Calendar size={13} className="text-brand-primary shrink-0" />
                <span className="font-bold">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-success/15 text-success font-medium border border-success/20">
                    Actual
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-text-muted transition-transform duration-200 shrink-0",
                    isMonthDropdownOpen && "transform rotate-180 text-brand-primary"
                  )}
                />
              </button>

              {/* Popover flotante Liquid Glass con Framer Motion */}
              <AnimatePresence>
                {isMonthDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 4, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-64 z-100 rounded-xl bg-surface-dark/95 backdrop-blur-xl border border-border-medium shadow-glass p-1.5 overflow-hidden"
                  >
                    <div className="px-3 py-2 text-[11px] font-semibold text-text-muted border-b border-border-light flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-brand-primary" />
                        Seleccionar Mes
                      </span>
                      <span className="text-[10px] text-text-muted/80">Histórico</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 py-1 pr-0.5">
                      {monthOptions.map((opt) => {
                        const isSelected = opt.month === selectedMonth && opt.year === selectedYear;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              selectMonthAndYear(opt.month, opt.year);
                              setIsMonthDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left",
                              isSelected
                                ? "bg-brand-primary/15 text-brand-primary font-bold border border-brand-primary/25"
                                : "text-text-secondary hover:text-text-primary hover:bg-surface-light"
                            )}
                          >
                            <div className="flex items-center gap-2.5 truncate pr-2">
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  isSelected
                                    ? "bg-brand-primary ring-2 ring-brand-primary/30"
                                    : opt.isCurrent
                                    ? "bg-success ring-2 ring-success/30"
                                    : "bg-border-medium"
                                )}
                              />
                              <span className="truncate">
                                {MONTH_NAMES[opt.month - 1]} {opt.year}
                              </span>
                              {opt.isCurrent && !isSelected && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-success/10 text-success border border-success/20 font-medium">
                                  Actual
                                </span>
                              )}
                            </div>

                            {isSelected && (
                              <Check size={14} className="text-brand-primary shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              title={isCurrentMonth ? 'No hay meses posteriores' : 'Mes siguiente'}
              className={`p-1.5 rounded-lg transition-colors ${
                isCurrentMonth
                  ? 'text-text-muted/40 cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary hover:bg-border-light'
              }`}
            >
              <ChevronRight size={16} />
            </button>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={handleResetCurrentMonth}
                title="Volver al mes actual"
                className="ml-1 px-2 py-1 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-[11px] font-medium flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={11} />
                Actual
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-56 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center">
            <p className="text-danger font-medium text-sm">No se pudo cargar el análisis de ingresos para este periodo.</p>
            <p className="text-xs text-text-muted mt-1">Por favor, intenta nuevamente o selecciona otro mes.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards Superiores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Ingresos */}
              <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-4 relative overflow-hidden flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Total Recaudado</span>
                  <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
                    <CircleDollarSign size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-success">
                    {formatCurrency(data.total_income)}
                  </span>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">
                    Confirmado en caja y cuentas bancarias
                  </p>
                </div>
              </div>

              {/* Total Transacciones */}
              <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-4 relative overflow-hidden flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Cobros Registrados</span>
                  <div className="w-8 h-8 rounded-lg bg-brand-primary/15 text-brand-primary flex items-center justify-center">
                    <Receipt size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                    {data.total_transactions}
                  </span>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">
                    Pagos procesados exitosamente
                  </p>
                </div>
              </div>

              {/* Ticket Promedio */}
              <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-4 relative overflow-hidden flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Ticket Promedio</span>
                  <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                    {formatCurrency(data.average_ticket)}
                  </span>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">
                    Promedio por cada transacción
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfica de Evolución Diaria */}
            <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Calendar size={16} className="text-brand-primary" />
                    Evolución Diaria del Mes
                  </h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Toca o haz clic en cualquier día para abrir su desglose y cobros específicos.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {data.highest_day && (
                    <div className="text-xs font-medium px-2.5 py-1 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center gap-1.5">
                      <Sparkles size={13} />
                      Pico máximo: Día {data.highest_day.day} ({formatCurrency(data.highest_day.amount)})
                    </div>
                  )}
                  {selectedDay !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-border-light hover:bg-border-medium text-text-primary flex items-center gap-1 transition-colors"
                    >
                      <X size={12} />
                      Ver todo el mes
                    </button>
                  )}
                </div>
              </div>

              {/* Contenedor de barras estables sin flicker */}
              <div className="pt-2 pb-2">
                <div className="flex items-end gap-1.5 h-36 w-full px-1 border-b border-border-light overflow-x-auto custom-scrollbar pb-1">
                  {data.daily_history.map((dayItem) => {
                    const amt = Number(dayItem.amount);
                    const isSelected = selectedDay === dayItem.day;
                    const heightPercent = highestAmount > 0 && amt > 0 
                      ? Math.max(14, Math.round((amt / highestAmount) * 100))
                      : 6;
                    const hasRevenue = amt > 0;

                    return (
                      <button
                        key={dayItem.date}
                        type="button"
                        onClick={() => handleDayClick(dayItem.day)}
                        title={`Día ${dayItem.day} de ${data.month_name}: ${formatCurrency(amt)} (${dayItem.transaction_count} ${dayItem.transaction_count === 1 ? 'pago' : 'pagos'})`}
                        className={`flex-1 min-w-6 flex flex-col items-center justify-end h-full group cursor-pointer focus:outline-none transition-all duration-150 relative ${
                          isSelected ? 'scale-[1.03] z-10' : ''
                        }`}
                      >
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-200 ${
                            isSelected
                              ? 'bg-linear-to-t from-brand-primary to-brand-primary/80 ring-2 ring-brand-primary ring-offset-2 ring-offset-bg-surface shadow-lg shadow-brand-primary/30'
                              : hasRevenue
                              ? 'bg-linear-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300 shadow-sm shadow-emerald-500/20'
                              : 'bg-border-light/40 group-hover:bg-border-medium/70'
                          }`}
                        />
                        <span
                          className={`text-[10px] mt-2 transition-colors ${
                            isSelected
                              ? 'font-bold text-brand-primary'
                              : hasRevenue
                              ? 'font-semibold text-text-primary'
                              : 'text-text-muted group-hover:text-text-secondary'
                          }`}
                        >
                          {dayItem.day}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-muted mt-2 px-1">
                  <span>Día 1</span>
                  <span>
                    {selectedDay
                      ? `Mostrando cobros del Día ${selectedDay}`
                      : 'Distribución completa del mes'}
                  </span>
                  <span>Día {data.daily_history[data.daily_history.length - 1]?.day || 30}</span>
                </div>
              </div>

              {/* Mini-tabla / Desglose del Día Seleccionado */}
              {selectedDay !== null && selectedDayData && (
                <div className="mt-4 p-4 rounded-xl bg-bg-surface/90 border border-brand-primary/30 shadow-glass transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-light">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-brand-primary/15 text-brand-primary flex items-center justify-center font-bold text-sm">
                        {selectedDayData.day}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-text-primary">
                          Cobros del Día {selectedDayData.day} de {data.month_name}
                        </h5>
                        <p className="text-[11px] text-text-muted">
                          {selectedDayData.transaction_count} {selectedDayData.transaction_count === 1 ? 'pago registrado' : 'pagos registrados'} en esta fecha
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-xs text-text-muted block">Total del día:</span>
                        <span className="text-base font-bold text-success">
                          {formatCurrency(selectedDayData.amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-border-light transition-colors"
                        title="Cerrar detalle del día"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Tabla / Lista de cobros de ese día */}
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {dayPayments.length === 0 ? (
                      <div className="py-5 text-center">
                        <p className="text-xs text-text-muted">
                          {Number(selectedDayData.amount) === 0
                            ? 'No se registraron cobros en este día.'
                            : 'Cobros procesados en la fecha.'}
                        </p>
                      </div>
                    ) : (
                      dayPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-bg-surface border border-border-light text-xs hover:border-border-medium transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded bg-bg-surface-dark border border-border-light shrink-0">
                              {getConceptIcon(p.concept)}
                            </div>
                            <div>
                              <p className="font-semibold text-text-primary">
                                {p.client_name || 'Cliente Mostrador'}
                              </p>
                              <p className="text-[11px] text-text-secondary">
                                {p.concept_description}
                              </p>
                              <span className="text-[10px] text-text-muted">
                                {formatDate(p.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-success">
                              + {formatCurrency(p.amount)}
                            </p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-border-light text-text-secondary font-medium inline-block mt-0.5">
                              {p.payment_method_label}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dos Columnas de Desglose */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Desglose por Concepto */}
              <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <ClipboardList size={16} className="text-info" />
                      ¿De dónde proviene el dinero?
                    </h4>
                    <span className="text-[11px] text-text-muted">Por Concepto</span>
                  </div>
                  <p className="text-xs text-text-secondary mb-4">
                    Origen de los ingresos según la actividad del gimnasio:
                  </p>

                  <div className="space-y-4">
                    {data.by_concept.map((concept) => (
                      <div key={concept.concept} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-bg-surface border border-border-light">
                              {getConceptIcon(concept.concept)}
                            </div>
                            <span className="font-medium text-text-primary">{concept.label}</span>
                            <span className="text-[10px] text-text-muted">({concept.transaction_count})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-text-primary">{formatCurrency(concept.amount)}</span>
                            <span className="text-xs text-text-muted ml-1.5">({concept.percentage}%)</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-border-light/30 overflow-hidden">
                          <div
                            style={{ width: `${concept.percentage}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              concept.concept === 'MEMBERSHIP'
                                ? 'bg-info'
                                : concept.concept === 'SALE'
                                ? 'bg-brand-primary'
                                : 'bg-success'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desglose por Método de Pago */}
              <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <CreditCard size={16} className="text-warning" />
                      ¿Cómo te pagaron tus clientes?
                    </h4>
                    <span className="text-[11px] text-text-muted">Por Medio de Pago</span>
                  </div>
                  <p className="text-xs text-text-secondary mb-4">
                    Canales de recaudo utilizados para abonar transacciones:
                  </p>

                  <div className="space-y-4">
                    {data.by_method.length === 0 ? (
                      <p className="text-xs text-text-muted italic">No hay registros de pagos este mes.</p>
                    ) : (
                      data.by_method.map((method) => (
                        <div key={method.method} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded bg-bg-surface border border-border-light">
                                {getMethodIcon(method.method)}
                              </div>
                              <span className="font-medium text-text-primary">{method.label}</span>
                              <span className="text-[10px] text-text-muted">({method.transaction_count})</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-text-primary">{formatCurrency(method.amount)}</span>
                              <span className="text-xs text-text-muted ml-1.5">({method.percentage}%)</span>
                            </div>
                          </div>
                          <div className="h-2 w-full rounded-full bg-border-light/30 overflow-hidden">
                            <div
                              style={{ width: `${method.percentage}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                method.method === 'CASH'
                                  ? 'bg-success'
                                  : method.method === 'TRANSFER'
                                  ? 'bg-info'
                                  : 'bg-warning'
                              }`}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Caja Pedagógica Informativa */}
            <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 flex gap-3 items-start">
              <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary shrink-0 mt-0.5">
                <Info size={18} />
              </div>
              <div className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-text-primary font-semibold">¿Cómo se calculan estos ingresos?</strong>
                <p className="mt-1">
                  Este informe refleja exclusivamente el <strong>dinero real recaudado y liquidado</strong> en caja o cuentas bancarias durante lo corrido del mes calendario.
                  Las ventas o membresías otorgadas a crédito (fiadas) <strong>no</strong> se contabilizan aquí hasta que el cliente realice su abono real en el sistema.
                </p>
              </div>
            </div>

            {/* Lista de Pagos Recientes */}
            <div className="rounded-2xl bg-bg-surface/60 border border-border-light p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">
                    Últimos Pagos Recibidos
                  </h4>
                  <p className="text-xs text-text-muted">Transacciones más recientes registradas este mes</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate('/app/cash-registers');
                  }}
                  className="text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  Ver en Caja <ArrowRight size={13} />
                </Button>
              </div>

              {/* Filtro rápido por Método de Pago */}
              {data.recent_payments.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 mb-4">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodFilterChange('ALL')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0 border",
                      paymentMethodFilter === 'ALL'
                        ? "bg-bg-elevated text-text-primary border-border-medium font-semibold shadow-xs"
                        : "bg-bg-surface/50 text-text-muted border-transparent hover:text-text-secondary hover:border-border-light"
                    )}
                  >
                    <span>Todos</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      paymentMethodFilter === 'ALL' ? "bg-bg-surface text-text-primary font-bold" : "bg-bg-surface/50 text-text-muted"
                    )}>
                      {data.recent_payments.length}
                    </span>
                  </button>

                  {paymentMethodsList.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => handlePaymentMethodFilterChange(m.code)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0 border",
                        paymentMethodFilter === m.code
                          ? "bg-bg-elevated text-brand-primary border-border-medium font-semibold shadow-xs"
                          : "bg-bg-surface/50 text-text-muted border-transparent hover:text-text-secondary hover:border-border-light"
                      )}
                    >
                      {getMethodIcon(m.code)}
                      <span>{m.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full",
                        paymentMethodFilter === m.code ? "bg-brand-primary/20 text-brand-primary font-bold" : "bg-bg-surface/50 text-text-muted"
                      )}>
                        {m.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2.5">
                {data.recent_payments.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-6">No hay cobros registrados en este periodo.</p>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-text-muted">
                      No hay transacciones registradas con el método de pago seleccionado.
                    </p>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethodFilterChange('ALL')}
                      className="mt-2 text-xs font-medium text-brand-primary hover:underline"
                    >
                      Restablecer filtro
                    </button>
                  </div>
                ) : (
                  paginatedPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-bg-surface/80 border border-border-light/50 hover:border-border-medium transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-bg-surface border border-border-light">
                          {getConceptIcon(payment.concept)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text-primary">
                            {payment.client_name ? payment.client_name : 'Cliente General'}
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {payment.concept_description}
                          </p>
                          <span className="text-[10px] text-text-muted">
                            {formatDate(payment.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-success">
                          + {formatCurrency(payment.amount)}
                        </span>
                        <div className="mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-border-light text-text-secondary font-medium">
                            {payment.payment_method_label}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginación y contador de transacciones */}
              {filteredPayments.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border-light/60">
                  <p className="text-xs text-text-muted text-center sm:text-left">
                    Mostrando <span className="font-semibold text-text-primary">{(currentPaymentPage - 1) * paymentPageSize + 1}</span> a{' '}
                    <span className="font-semibold text-text-primary">
                      {Math.min(currentPaymentPage * paymentPageSize, filteredPayments.length)}
                    </span>{' '}
                    de <span className="font-semibold text-text-primary">{filteredPayments.length}</span> transacciones
                  </p>
                  <div className="[&>div]:mt-0 shrink-0">
                    <Pagination
                      page={currentPaymentPage}
                      totalPages={totalPaymentPages}
                      onPageChange={setPaymentPage}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Acciones Finales */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border-light">
              <p className="text-[11px] text-text-muted">
                Merwil ZonaFit Financial Analytics • Datos actualizados automáticamente
              </p>
              <Button onClick={onClose} variant="primary" className="w-full sm:w-auto px-6">
                Entendido, volver al Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}