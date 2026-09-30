import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  CircleDollarSign,
  ShoppingCart,
  Users,
  Package,
  Banknote,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  CalendarCheck,
  CreditCard,
  Smartphone,
} from 'lucide-react';

import { useReports } from '../../hooks/useReports';
import { useDashboard } from '../../hooks/useDashboard';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';
import {
  SectionEyebrow,
  Metric,
  KPIGrid,
  GlassPanel,
  StatusBadge,
} from '@shared/ui';
import { Button } from '@shared/ui/Button';
import { Skeleton } from '@shared/ui/Skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';

type PresetRange = '7D' | '30D' | '90D' | 'THIS_MONTH' | 'CUSTOM';

const getPresetDates = (preset: PresetRange) => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start = new Date();

  if (preset === '7D') {
    start.setDate(now.getDate() - 6);
  } else if (preset === '30D') {
    start.setDate(now.getDate() - 29);
  } else if (preset === '90D') {
    start.setDate(now.getDate() - 89);
  } else if (preset === 'THIS_MONTH') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return {
    start: start.toISOString().split('T')[0],
    end,
  };
};

const getPriorPeriodDates = (startStr: string, endStr: string) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);

  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (diffDays - 1));

  return {
    start: priorStart.toISOString().split('T')[0],
    end: priorEnd.toISOString().split('T')[0],
  };
};

export function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const getRoute = (path: string) => (isDemo ? `/demo${path}` : path);

  const [preset, setPreset] = useState<PresetRange>('30D');
  const [customStart, setCustomStart] = useState<string>(() => getPresetDates('30D').start);
  const [customEnd, setCustomEnd] = useState<string>(() => getPresetDates('30D').end);
  const [expiringDays, setExpiringDays] = useState<number>(7);

  // Fechas activas para la consulta
  const activeDates = useMemo(() => {
    if (preset === 'CUSTOM') {
      return { start: customStart, end: customEnd };
    }
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);

  // Período anterior para comparación temporal real y verificable
  const priorDates = useMemo(() => {
    return getPriorPeriodDates(activeDates.start, activeDates.end);
  }, [activeDates]);

  // Queries de reportes
  const {
    salesSummary,
    salesByDate,
    salesByClient,
    topProducts,
    lowStock,
    paymentsByMethod,
    membershipsExpiring,
  } = useReports(activeDates.start, activeDates.end, expiringDays);

  // Consulta del período anterior para calcular deltas reales
  const priorSalesQuery = useReports(priorDates.start, priorDates.end, expiringDays).salesByDate;

  // Datos consolidados del dashboard y caja para la Salud del Gimnasio
  const dashboard = useDashboard();
  const { activeRegister, activeSummary } = useCashRegisters();
  const isCajaOpen = !!activeRegister.data && activeRegister.data.status === 'OPEN';

  // Comparación temporal calculada exclusivamente con datos reales
  const currentIncome = Number(salesByDate.data?.total_income ?? 0);
  const priorIncome = Number(priorSalesQuery.data?.total_income ?? 0);
  const incomeDelta = priorIncome > 0 ? ((currentIncome - priorIncome) / priorIncome) * 100 : undefined;

  const currentSales = salesByDate.data?.total_sales ?? 0;
  const priorSales = priorSalesQuery.data?.total_sales ?? 0;
  const salesDelta = priorSales > 0 ? ((currentSales - priorSales) / priorSales) * 100 : undefined;

  const ticketPromedio = currentSales > 0 ? currentIncome / currentSales : 0;

  // Métodos de pago formateados
  const totalPaymentIncome = useMemo(() => {
    if (!paymentsByMethod.data) return 0;
    return paymentsByMethod.data.reduce((acc, m) => acc + Number(m.total_amount), 0);
  }, [paymentsByMethod.data]);

  const getMethodLabel = (code: string) => {
    switch (code.toUpperCase()) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia bancaria';
      case 'CARD':
        return 'Tarjeta / Datáfono';
      default:
        return code;
    }
  };

  const getMethodIcon = (code: string) => {
    switch (code.toUpperCase()) {
      case 'CASH':
        return <Banknote size={16} className="text-emerald-400" />;
      case 'TRANSFER':
        return <Smartphone size={16} className="text-blue-400" />;
      case 'CARD':
        return <CreditCard size={16} className="text-amber-400" />;
      default:
        return <CircleDollarSign size={16} className="text-text-muted" />;
    }
  };

  const handleRefreshAll = () => {
    salesSummary.refetch();
    salesByDate.refetch();
    priorSalesQuery.refetch();
    salesByClient.refetch();
    topProducts.refetch();
    lowStock.refetch();
    paymentsByMethod.refetch();
    membershipsExpiring.refetch();
    dashboard.refetch();
  };

  return (
    <div className="flex flex-col gap-10 pb-16 font-sans">
      {/* ========================================================
          HEADER & FILTROS DE PERÍODO
         ======================================================== */}
      <header className="flex flex-col gap-4 border-b border-border-light pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted font-semibold">
                INTELIGENCIA OPERATIVA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-text-primary">
              Reportes & <span className="font-medium text-white">Salud del Gimnasio</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-3xl leading-relaxed">
              Consolidación financiera, rotación de inventario, facturación de clientes y vigencia de membresías con datos auditables en tiempo real.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
              title="Actualizar todos los datos"
            >
              <RefreshCw size={13} className={salesByDate.isFetching ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros Segmentados */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-panel/60 p-1 rounded-xl border border-border-light">
            {(['7D', '30D', '90D', 'THIS_MONTH'] as PresetRange[]).map((p) => {
              const labelMap: Record<PresetRange, string> = {
                '7D': 'Últimos 7 días',
                '30D': 'Últimos 30 días',
                '90D': 'Últimos 90 días',
                'THIS_MONTH': 'Mes actual',
                'CUSTOM': 'Personalizado',
              };
              const isSelected = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono rounded-lg transition-all',
                    isSelected
                      ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-xs'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  {labelMap[p]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPreset('CUSTOM')}
              className={cn(
                'px-3 py-1.5 text-xs font-mono rounded-lg transition-all',
                preset === 'CUSTOM'
                  ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-xs'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Personalizado
            </button>
          </div>

          {/* Rango de Fechas Activo */}
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Calendar size={13} className="text-brand-primary" />
            <span>
              {formatDate(activeDates.start)} — {formatDate(activeDates.end)}
            </span>
          </div>
        </div>

        {/* Selector de Rango Personalizado */}
        {preset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-surface-panel/40 border border-border-light text-xs font-mono">
            <label className="flex items-center gap-2">
              <span className="text-text-muted">Desde:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-surface-base border border-border-light rounded-lg px-2.5 py-1 text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-text-muted">Hasta:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-surface-base border border-border-light rounded-lg px-2.5 py-1 text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </label>
          </div>
        )}
      </header>

      {/* ========================================================
          SALUD DEL GIMNASIO (CAPA ANALÍTICA VERIFICABLE)
         ======================================================== */}
      <section className="flex flex-col gap-4" aria-label="Salud del gimnasio">
        <GlassPanel
          variant="elevated"
          padding="lg"
          rounded="2xl"
          className="border border-white/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-light">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <BarChart3 size={16} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Diagnóstico de Salud del Gimnasio
                </h2>
                <p className="text-xs text-text-muted">
                  Indicadores operativos consolidados basados en registros comprobables.
                </p>
              </div>
            </div>

            <StatusBadge
              status={isCajaOpen ? 'active' : 'neutral'}
              label={isCajaOpen ? 'Operación en Marcha' : 'Caja Cerrada'}
              mode="pill"
              size="md"
            />
          </div>

          {/* Grilla de los 6 Pilares Comprobables */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
            {/* 1: Ingresos del Mes */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Ingresos Mes</span>
              <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
                {formatCurrency(dashboard.data?.income_this_month)}
              </span>
              <span className="text-[10px] text-text-secondary truncate">Recaudo acumulado</span>
            </div>

            {/* 2: Ventas en Período */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Ventas Período</span>
              <span className="font-mono text-base sm:text-lg font-bold text-text-primary">
                {formatCurrency(salesByDate.data?.total_income ?? 0)}
              </span>
              <span className="text-[10px] text-text-secondary truncate">
                {salesByDate.data?.total_sales ?? 0} transacciones
              </span>
            </div>

            {/* 3: Clientes Activos */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Afiliados Activos</span>
              <span className="font-mono text-base sm:text-lg font-bold text-text-primary">
                {dashboard.data?.active_clients ?? 0}
              </span>
              <span className="text-[10px] text-text-secondary truncate">Membresía vigente</span>
            </div>

            {/* 4: Cartera por Cobrar */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Cartera Pendiente</span>
              <span className="font-mono text-base sm:text-lg font-bold text-rose-400">
                {formatCurrency(dashboard.data?.total_receivables ?? 0)}
              </span>
              <span className="text-[10px] text-text-secondary truncate">
                {dashboard.data?.overdue_receivables && dashboard.data.overdue_receivables > 0
                  ? `${formatCurrency(dashboard.data.overdue_receivables)} mora`
                  : 'Saldos al día'}
              </span>
            </div>

            {/* 5: Stock Bajo */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Alerta de Stock</span>
              <span className="font-mono text-base sm:text-lg font-bold text-amber-400">
                {lowStock.data?.length ?? 0}
              </span>
              <span className="text-[10px] text-text-secondary truncate">Productos bajo mínimo</span>
            </div>

            {/* 6: Arqueo en Turno */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-base/50 border border-border-light">
              <span className="font-mono text-[10px] text-text-muted uppercase">Efectivo Turno</span>
              <span className="font-mono text-base sm:text-lg font-bold text-text-primary">
                {isCajaOpen
                  ? formatCurrency(activeSummary.data?.expected_cash ?? activeRegister.data?.opening_balance ?? 0)
                  : '$0'}
              </span>
              <span className="text-[10px] text-text-secondary truncate">
                {isCajaOpen ? 'Esperado en gaveta' : 'Turno cerrado'}
              </span>
            </div>
          </div>

          {/* Diagnóstico Descriptivo Factual */}
          <div className="mt-4 p-4 rounded-xl bg-surface-base/30 border border-border-light text-xs text-text-secondary leading-relaxed">
            <p>
              <strong className="text-text-primary font-semibold">Resumen de situación: </strong>
              Durante el período evaluado ({formatDate(activeDates.start)} a {formatDate(activeDates.end)}), se registraron{' '}
              <span className="text-white font-medium">{salesByDate.data?.total_sales ?? 0} ventas</span> por un total de{' '}
              <span className="text-white font-medium">{formatCurrency(salesByDate.data?.total_income ?? 0)}</span>. El gimnasio cuenta con{' '}
              <span className="text-white font-medium">{dashboard.data?.active_clients ?? 0} afiliados vigentes</span>,{' '}
              <span className="text-white font-medium">{formatCurrency(dashboard.data?.total_receivables ?? 0)}</span> en cuentas por cobrar pendientes, y{' '}
              <span className="text-white font-medium">{lowStock.data?.length ?? 0} productos</span> en inventario con existencias bajo el umbral mínimo.{' '}
              El turno de caja se encuentra actualmente <span className="text-white font-medium">{isCajaOpen ? 'abierto' : 'cerrado'}</span>.
            </p>
          </div>
        </GlassPanel>
      </section>

      {/* ========================================================
          01 — SECCIÓN VENTAS & INGRESOS
         ======================================================== */}
      <section className="flex flex-col gap-6" aria-label="Reporte de ventas">
        <SectionEyebrow
          index="01"
          label="VENTAS & RECAUDO"
          title="Rendimiento de Ventas & Medios de Pago"
          description="Evolución en el período seleccionado, promedio por transacción y distribución por canal de pago."
          hasDivider={true}
        />

        {/* KPIGrid con Deltas vs Período Anterior */}
        <KPIGrid columns={3} className="rounded-2xl bg-surface-panel/40 liquid-glass-soft px-4 py-2">
          {/* Ingresos en Período */}
          <div className="p-4 sm:p-5">
            <Metric
              index="A"
              label="Ingresos en Período"
              value={formatCurrency(currentIncome)}
              delta={incomeDelta}
              deltaHint="vs. período anterior"
              isPositiveGood={true}
              secondaryText={`Período previo: ${formatCurrency(priorIncome)}`}
              action={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp size={16} />
                </div>
              }
            />
          </div>

          {/* Transacciones en Período */}
          <div className="p-4 sm:p-5">
            <Metric
              index="B"
              label="Ventas Registradas"
              value={currentSales}
              delta={salesDelta}
              deltaHint="vs. período anterior"
              isPositiveGood={true}
              secondaryText={`Período previo: ${priorSales} ventas`}
              action={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                  <ShoppingCart size={16} />
                </div>
              }
            />
          </div>

          {/* Ticket Promedio */}
          <div className="p-4 sm:p-5">
            <Metric
              index="C"
              label="Ticket Promedio"
              value={formatCurrency(ticketPromedio)}
              secondaryText="Promedio facturado por cada venta"
              action={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <CircleDollarSign size={16} />
                </div>
              }
            />
          </div>
        </KPIGrid>

        {/* División: Histórico Global vs Medios de Pago */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tarjeta: Resumen Histórico Global */}
          <GlassPanel variant="subtle" padding="md" rounded="2xl" className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Ventas Históricas Acumuladas</h3>
                    <p className="text-[11px] text-text-muted">Total consolidado desde la apertura del gimnasio</p>
                  </div>
                </div>
                <StatusBadge status="neutral" label="Histórico" mode="pill" size="sm" />
              </div>

              {salesSummary.isLoading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-10 w-48 rounded-lg" />
                  <Skeleton className="h-6 w-36 rounded-md" />
                </div>
              ) : salesSummary.isError ? (
                <div className="py-6 text-center text-xs text-rose-400">
                  No se pudo cargar el consolidado histórico de ventas.
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div>
                    <span className="font-mono text-3xl font-light text-text-primary">
                      {formatCurrency(salesSummary.data?.total_income ?? 0)}
                    </span>
                    <p className="text-xs text-text-secondary mt-1">
                      Recaudación total bruta generada en el módulo de ventas
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-base/50 border border-border-light flex items-center justify-between text-xs">
                    <span className="text-text-muted font-mono uppercase">Total Transacciones Realizadas:</span>
                    <span className="font-mono font-bold text-text-primary text-sm">
                      {salesSummary.data?.total_sales ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-light">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(getRoute('/sales'))}
                className="w-full text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ShoppingCart size={14} />
                <span>Ir al Punto de Venta (POS)</span>
              </Button>
            </div>
          </GlassPanel>

          {/* Tarjeta: Distribución por Medio de Pago */}
          <GlassPanel variant="subtle" padding="md" rounded="2xl" className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Distribución por Medios de Pago</h3>
                    <p className="text-[11px] text-text-muted">Total de recaudos liquidados por canal</p>
                  </div>
                </div>
              </div>

              {paymentsByMethod.isLoading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-8 w-full rounded-lg" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ) : paymentsByMethod.isError ? (
                <div className="py-6 text-center text-xs text-rose-400">
                  No se pudo cargar la distribución de pagos.
                </div>
              ) : !paymentsByMethod.data || paymentsByMethod.data.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  No se registran pagos en el sistema.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {paymentsByMethod.data.map((pm) => {
                    const amt = Number(pm.total_amount);
                    const pct = totalPaymentIncome > 0 ? Math.round((amt / totalPaymentIncome) * 100) : 0;
                    return (
                      <div key={pm.payment_method} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-surface-base border border-border-light">
                              {getMethodIcon(pm.payment_method)}
                            </div>
                            <span className="font-medium text-text-primary">
                              {getMethodLabel(pm.payment_method)}
                            </span>
                            <span className="font-mono text-[10px] text-text-muted">
                              ({pm.total_payments} pagos)
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-semibold text-text-primary">
                              {formatCurrency(amt)}
                            </span>
                            <span className="font-mono text-[11px] text-text-muted ml-2">
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Barra Proporcional */}
                        <div className="h-2 w-full rounded-full bg-border-light/30 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              pm.payment_method === 'CASH' && 'bg-emerald-400',
                              pm.payment_method === 'TRANSFER' && 'bg-blue-400',
                              pm.payment_method === 'CARD' && 'bg-amber-400',
                              pm.payment_method !== 'CASH' && pm.payment_method !== 'TRANSFER' && pm.payment_method !== 'CARD' && 'bg-brand-primary'
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-light flex items-center justify-between text-xs text-text-muted font-mono">
              <span>Total liquidado:</span>
              <span className="text-text-primary font-bold">{formatCurrency(totalPaymentIncome)}</span>
            </div>
          </GlassPanel>
        </div>
      </section>

      {/* ========================================================
          02 — SECCIÓN PRODUCTOS & INVENTARIO
         ======================================================== */}
      <section className="flex flex-col gap-6" aria-label="Reporte de productos">
        <SectionEyebrow
          index="02"
          label="PRODUCTOS & INVENTARIO"
          title="Rendimiento de Mostrador y Stock"
          description="Rotación de artículos comerciales y detección temprana de existencias agotadas o mínimas."
          hasDivider={true}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Productos Más Vendidos */}
          <GlassPanel variant="subtle" padding="none" rounded="2xl" className="border border-border-light overflow-hidden">
            <div className="p-5 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Package size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Productos Más Vendidos</h3>
                  <p className="text-[11px] text-text-muted">Ordenados por unidades totales comercializadas</p>
                </div>
              </div>
            </div>

            {topProducts.isLoading ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : topProducts.isError ? (
              <div className="p-8 text-center text-xs text-rose-400">
                Error al consultar los productos más vendidos.
              </div>
            ) : !topProducts.data || topProducts.data.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No hay ventas de productos registradas en el historial.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 font-mono text-2xs uppercase">#</TableHead>
                      <TableHead className="font-mono text-2xs uppercase">Producto</TableHead>
                      <TableHead className="text-center font-mono text-2xs uppercase">Vendidos</TableHead>
                      <TableHead className="text-right font-mono text-2xs uppercase">Total Recaudado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.data.slice(0, 10).map((prod, idx) => (
                      <TableRow key={prod.product_id} className="hover:bg-white/[0.02]">
                        <TableCell className="font-mono text-xs text-text-muted">
                          {String(idx + 1).padStart(2, '0')}
                        </TableCell>
                        <TableCell className="font-medium text-text-primary text-xs">
                          {prod.product_name}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-semibold text-text-primary">
                          {prod.total_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                          {formatCurrency(prod.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassPanel>

          {/* Alertas de Stock Bajo Mínimo */}
          <GlassPanel variant="subtle" padding="none" rounded="2xl" className="border border-border-light overflow-hidden">
            <div className="p-5 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Productos con Stock Crítico</h3>
                  <p className="text-[11px] text-text-muted">Existencias en o por debajo del stock mínimo</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(getRoute('/sales'))}
                className="text-xs"
              >
                Ver POS
              </Button>
            </div>

            {lowStock.isLoading ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : lowStock.isError ? (
              <div className="p-8 text-center text-xs text-rose-400">
                Error al consultar el inventario bajo mínimo.
              </div>
            ) : !lowStock.data || lowStock.data.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                <Package className="mx-auto h-7 w-7 mb-2 opacity-30 text-emerald-400" />
                <p>Todos los productos tienen existencias suficientes sobre el mínimo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-2xs uppercase">Producto</TableHead>
                      <TableHead className="text-center font-mono text-2xs uppercase">Stock Actual</TableHead>
                      <TableHead className="text-center font-mono text-2xs uppercase">Mínimo</TableHead>
                      <TableHead className="text-right font-mono text-2xs uppercase">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.data.map((item) => (
                      <TableRow key={item.product_id} className="hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-text-primary text-xs">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-amber-400">
                          {item.stock}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-text-muted">
                          {item.min_stock}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge
                            status={item.stock === 0 ? 'danger' : 'warning'}
                            label={item.stock === 0 ? 'Agotado' : 'Reabastecer'}
                            mode="pill"
                            size="sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassPanel>
        </div>
      </section>

      {/* ========================================================
          03 — SECCIÓN CLIENTES CON MAYOR CONSUMO
         ======================================================== */}
      <section className="flex flex-col gap-6" aria-label="Reporte de clientes">
        <SectionEyebrow
          index="03"
          label="CONSUMO DE CLIENTES"
          title="Top Clientes por Facturación"
          description="Socios que mayor volumen de ventas han generado en el sistema de forma acumulada."
          hasDivider={true}
        />

        <GlassPanel variant="subtle" padding="none" rounded="2xl" className="border border-border-light overflow-hidden">
          <div className="p-5 border-b border-border-light flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Ranking de Compras de Clientes</h3>
                <p className="text-[11px] text-text-muted">Datos ordenados por valor total facturado</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getRoute('/clients'))}
              className="text-xs"
            >
              Ver Directorio de Clientes
            </Button>
          </div>

          {salesByClient.isLoading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : salesByClient.isError ? (
            <div className="p-8 text-center text-xs text-rose-400">
              Error al consultar las ventas por cliente.
            </div>
          ) : !salesByClient.data || salesByClient.data.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No hay compras de clientes registradas en el historial.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 font-mono text-2xs uppercase">#</TableHead>
                    <TableHead className="font-mono text-2xs uppercase">Cliente</TableHead>
                    <TableHead className="text-center font-mono text-2xs uppercase">Compras Registradas</TableHead>
                    <TableHead className="text-right font-mono text-2xs uppercase">Total Consumido</TableHead>
                    <TableHead className="text-right font-mono text-2xs uppercase">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByClient.data.slice(0, 15).map((c, idx) => (
                    <TableRow key={c.client_id} className="hover:bg-white/[0.02]">
                      <TableCell className="font-mono text-xs text-text-muted">
                        {String(idx + 1).padStart(2, '0')}
                      </TableCell>
                      <TableCell className="font-medium text-text-primary text-xs">
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-text-muted" />
                          <span>{c.client_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold text-text-primary">
                        {c.total_sales}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-text-primary">
                        {formatCurrency(c.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={getRoute('/clients')}
                          className="text-xs font-semibold text-brand-primary hover:text-red-300 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Ficha</span>
                          <ArrowRight size={12} />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassPanel>
      </section>

      {/* ========================================================
          04 — SECCIÓN MEMBRESÍAS & PRÓXIMOS VENCIMIENTOS
         ======================================================== */}
      <section className="flex flex-col gap-6" aria-label="Reporte de membresías">
        <SectionEyebrow
          index="04"
          label="GESTIÓN DE MEMBRESÍAS"
          title="Próximos Vencimientos y Vigencia"
          description="Socios activos que finalizarán su cobertura en el horizonte temporal seleccionado."
          hasDivider={true}
          action={
            <div className="flex items-center gap-1.5 bg-surface-panel p-1 rounded-xl border border-border-light">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiringDays(d)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-mono rounded-lg transition-all',
                    expiringDays === d
                      ? 'bg-brand-primary/20 text-red-300 font-semibold border border-brand-primary/40'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  {d} días
                </button>
              ))}
            </div>
          }
        />

        <GlassPanel variant="subtle" padding="none" rounded="2xl" className="border border-border-light overflow-hidden">
          <div className="p-5 border-b border-border-light flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <CalendarCheck size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Vencimientos en los Próximos {expiringDays} Días
                </h3>
                <p className="text-[11px] text-text-muted">
                  Total de {membershipsExpiring.data?.length ?? 0} socios programados para expiración
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getRoute('/memberships'))}
              className="text-xs"
            >
              Ver Todas las Membresías
            </Button>
          </div>

          {membershipsExpiring.isLoading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : membershipsExpiring.isError ? (
            <div className="p-8 text-center text-xs text-rose-400">
              Error al consultar las membresías por vencer.
            </div>
          ) : !membershipsExpiring.data || membershipsExpiring.data.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              <CalendarCheck className="mx-auto h-7 w-7 mb-2 opacity-30 text-emerald-400" />
              <p>No hay membresías que venzan en los próximos {expiringDays} días.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-2xs uppercase">Socio</TableHead>
                    <TableHead className="font-mono text-2xs uppercase">Fecha de Vencimiento</TableHead>
                    <TableHead className="font-mono text-2xs uppercase">Días Restantes</TableHead>
                    <TableHead className="text-right font-mono text-2xs uppercase">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membershipsExpiring.data.map((mem) => {
                    const isToday = mem.days_remaining === 0;
                    const isUrgent = mem.days_remaining <= 3;
                    return (
                      <TableRow key={mem.membership_id} className="hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-text-primary text-xs">
                          {mem.client_name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-text-muted">
                          {formatDate(mem.end_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={isToday ? 'expired' : isUrgent ? 'warning' : 'info'}
                            label={isToday ? 'Vence hoy' : `En ${mem.days_remaining} días`}
                            mode="pill"
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={getRoute('/memberships')}
                            className="px-2.5 py-1 text-xs font-semibold text-brand-primary hover:text-red-300 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-lg transition-colors inline-flex items-center gap-1 border border-brand-primary/20"
                          >
                            <span>Renovar</span>
                            <ArrowRight size={12} />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassPanel>
      </section>
    </div>
  );
}
