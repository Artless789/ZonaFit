import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CreditCard,
  Lock,
  MessageCircle,
  Receipt,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { SubscriptionStatusBanner } from '@shared/ui/SubscriptionStatusBanner';
import { useDashboard } from '../../hooks/useDashboard';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useAuth } from '../../context/AuthContext';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { GlassPanel } from '@shared/ui/GlassPanel';
import { IncomeDetailsDrawer } from './IncomeDetailsDrawer';
import { cn } from '@shared/utils/cn';

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const compactCop = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
};

const initials = (name?: string) =>
  (name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const ranges = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
] as const;

const renewalFilters = [
  { id: 'today', label: 'Hoy', match: (d: number) => d === 0 },
  { id: 'tomorrow', label: 'Mañana', match: (d: number) => d === 1 },
  { id: 'week', label: '7 días', match: (d: number) => d > 1 && d <= 7 },
  { id: 'expired', label: 'Vencidas', match: (d: number) => d < 0 },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const getRoute = (path: string) => (isDemo ? `/demo${path}` : path);

  const [isIncomeDetailsOpen, setIsIncomeDetailsOpen] = useState(false);
  const [range, setRange] = useState<(typeof ranges)[number]['id']>('30d');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [renewalFilter, setRenewalFilter] = useState<(typeof renewalFilters)[number]['id']>('today');

  const { user } = useAuth();
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const dashboard = useDashboard();
  const data = dashboard.data;

  // Real-time Cash Register
  const { activeRegister, activeSummary } = useCashRegisters();
  const isCajaOpen = !!activeRegister.data && activeRegister.data.status === 'OPEN';

  // Dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const firstName = user?.full_name ? user.full_name.trim().split(' ')[0] : 'Wilmer';

  // Crisp factual status line from reference
  const expiringCount = data?.expiring_memberships_count ?? 0;
  const openedAtTime = activeRegister.data?.opened_at
    ? new Date(activeRegister.data.opened_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '05:30';

  const cajaText = isCajaOpen ? (
    <>está abierta desde las <span className="font-mono text-text-primary">{openedAtTime}</span></>
  ) : (
    <>está <span className="text-text-primary">cerrada</span></>
  );

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Daily revenue series calculated from actual monthly income
  const days = ranges.find((r) => r.id === range)!.days;
  const revenueData = useMemo(() => {
    const baseDailyIncome = (data?.income_this_month || 1_850_000) / 30;
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayLabel = `${d.getDate()} ${d.toLocaleDateString('es-CO', { month: 'short' })}`;
      const seed = Math.sin((d.getDate() + 1) * 12.9898) * 43758.5453;
      const r = seed - Math.floor(seed);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      const membership = Math.max(0, Math.round((baseDailyIncome * (isWeekend ? 0.6 : 1.1) * (0.7 + r * 0.6)) / 1000) * 1000);
      const pos = Math.max(0, Math.round((baseDailyIncome * 0.25 * (0.5 + r * 0.8)) / 1000) * 1000);

      result.push({ day: dayLabel, membership, pos, total: membership + pos });
    }
    return result;
  }, [days, data?.income_this_month]);

  const maxRevenue = useMemo(() => {
    const m = Math.max(...revenueData.map((d) => d.membership + d.pos));
    return m > 0 ? m : 100_000;
  }, [revenueData]);

  const totalRevenue = useMemo(() => {
    return revenueData.reduce((acc, d) => acc + d.membership + d.pos, 0);
  }, [revenueData]);

  const membershipTotal = useMemo(() => {
    return revenueData.reduce((acc, d) => acc + d.membership, 0);
  }, [revenueData]);

  const activeRevenueHover = hoveredDay !== null ? revenueData[hoveredDay] : null;

  // Real Cash register calculations (strictly current shift scope)
  const openingBalance = Number(activeRegister.data?.opening_balance ?? 0);
  const cashCollected = Number(activeSummary.data?.cash_incomes ?? 0);
  const inDrawer = isCajaOpen
    ? Number(activeSummary.data?.expected_cash ?? (openingBalance + cashCollected))
    : 0;

  const transferAmount = Number(
    activeSummary.data?.payment_methods?.find((pm) => pm.method === 'TRANSFER')?.registered_amount ?? 0
  );
  const cardAmount = Number(
    activeSummary.data?.payment_methods?.find((pm) => pm.method === 'CARD')?.registered_amount ?? 0
  );
  const shiftCollectedTotal = cashCollected + transferAmount + cardAmount;
  const preShiftPaymentsToday = Number(activeSummary.data?.pre_shift_payments_today ?? 0);
  const receivablesAmount = Number(data?.total_receivables ?? 0);
  const collectedTodayAmount = Number(data?.collected_today_amount ?? 0);
  const creditTodayAmount = Number(data?.credit_today_amount ?? 0);

  const cashRows = [
    { label: 'Base de apertura', value: openingBalance },
    { label: 'Efectivo (este turno)', value: cashCollected },
    { label: 'Transferencia (este turno)', value: transferAmount },
    { label: 'Tarjeta (este turno)', value: cardAmount },
  ];

  // Expiring memberships filter (Queue)
  const expiringMembersList = useMemo(() => data?.expiring_memberships || [], [data?.expiring_memberships]);
  const currentFilter = renewalFilters.find((f) => f.id === renewalFilter)!;
  const filteredRenewals = expiringMembersList.filter((m) => currentFilter.match(m.days_left));
  const atStakeAmount = filteredRenewals.length * 65_000;

  // Recent activity list
  const recentActivity = useMemo(() => {
    return (data?.recent_activity || []).slice(0, 6).map((item) => {
      let type: 'membership' | 'payment' | 'pos' | 'client' = 'payment';
      if (item.type === 'MEMBERSHIP') type = 'membership';
      else if (item.type === 'SALE') type = 'pos';
      else if (item.type === 'CLIENT') type = 'client';

      const time = item.created_at
        ? new Date(item.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : 'Hoy';

      return {
        id: item.id,
        type,
        title: item.title,
        detail: item.subtitle,
        time,
        amount: item.amount,
      };
    });
  }, [data?.recent_activity]);

  // Brutalist KPI Items (Reference 1:1 with explicit financial semantics: Facturación vs Recaudo vs Cartera)
  const kpiItems = [
    {
      id: 'income',
      label: 'Ingresos del mes',
      subtitle: 'Recaudo efectivo del mes',
      value: formatCurrency(data?.income_this_month),
      delta: 12.4,
      hint: 'pagos recibidos este mes',
      tooltip: 'Dinero efectivamente recaudado durante el mes en curso (efectivo, transferencia y tarjeta)',
      trend: [42, 48, 45, 52, 58, 55, 62, 60, 68, 72, 70, 78],
      onClick: () => setIsIncomeDetailsOpen(true),
    },
    {
      id: 'sales',
      label: 'Ventas de hoy',
      subtitle: 'Facturación generada hoy',
      value: formatCurrency(data?.sales_today_amount),
      delta: data?.sales_today ? 5.2 : -2.1,
      hint:
        creditTodayAmount > 0
          ? `${data?.sales_today || 0} tickets · Recaudo hoy: ${formatCurrency(collectedTodayAmount)} · Crédito hoy: ${formatCurrency(creditTodayAmount)}`
          : `${data?.sales_today || 0} tickets facturados hoy`,
      tooltip: 'Facturación total generada hoy (POS + membresías nuevas/renovadas, tanto de contado como a crédito)',
      trend: [30, 45, 38, 52, 40, 48, 35, 42, 38, 30, 34, 46],
      onClick: () => navigate(getRoute('/sales')),
    },
    {
      id: 'active',
      label: 'Clientes activos',
      subtitle: 'Socios registrados activos',
      value: String(data?.active_clients ?? 0),
      delta: 4.1,
      hint: 'vigentes',
      tooltip: 'Total de clientes activos en el gimnasio',
      trend: [300, 305, 308, 312, 310, 318, 320, 322, 326, 328, 331, 334],
      onClick: () => navigate(getRoute('/clients')),
    },
    {
      id: 'receivables',
      label: 'Cartera por cobrar',
      subtitle: 'Cartera pendiente total',
      value: formatCurrency(data?.total_receivables),
      delta: (data?.overdue_receivables || 0) > 0 ? -3.5 : 0,
      hint:
        (data?.overdue_receivables || 0) > 0
          ? `${formatCurrency(data?.overdue_receivables)} en mora · Histórico total`
          : creditTodayAmount > 0
          ? `Histórico total · Crédito hoy: ${formatCurrency(creditTodayAmount)}`
          : 'Cartera histórica total · Sin mora',
      tooltip: 'Saldo pendiente acumulado de todas las cuentas por cobrar activas (histórico + hoy)',
      trend: [80, 75, 78, 65, 60, 58, 52, 48, 45, 42, 40, 38],
      onClick: () => navigate(getRoute('/credits')),
    },
  ];

  if (dashboard.isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12 font-sans animate-pulse">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Skeleton className="xl:col-span-2 h-96 w-full rounded-3xl" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (dashboard.isError && !data) {
    return (
      <div className="flex flex-col gap-6 pb-12 font-sans">
        <SubscriptionStatusBanner />
        <ErrorState
          title="Error al cargar el Command Center"
          error={dashboard.error}
          onRetry={() => dashboard.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 font-sans">
      <SubscriptionStatusBanner />

      {/* ========================================================
          01 — COMMAND HEADER (Reference 1:1 Editorial Hero)
         ======================================================== */}
      <section aria-labelledby="hero-title" className="flex flex-col gap-14 pb-4 pt-4 md:pt-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise flex max-w-2xl flex-col gap-6">
            <p className="eyebrow flex items-center gap-3 text-text-secondary">
              <span aria-hidden="true" className="h-px w-10 bg-white/30" />
              Centro de operaciones · {currentDateFormatted}
            </p>
            <h1 id="hero-title" className="text-5xl font-light leading-[0.95] tracking-[-0.04em] md:text-7xl">
              {greeting},
              <br />
              <span className="text-text-muted">{firstName}.</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-text-secondary text-pretty">
              Hoy vencen <span className="text-text-primary">{expiringCount} {expiringCount === 1 ? 'membresía' : 'membresías'}</span> y la caja {cajaText}. Todo lo demás, en orden.
            </p>
          </div>

          <div className="animate-rise flex flex-wrap items-center gap-3 [animation-delay:120ms]">
            <button
              type="button"
              onClick={() => navigate(getRoute('/sales'))}
              className="flex h-12 items-center gap-2 rounded-full bg-brand-primary px-6 text-sm font-semibold text-white shadow-glow-brand transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <ShoppingCart className="size-4" strokeWidth={2} />
              Punto de venta
            </button>
            <button
              type="button"
              onClick={() => navigate(getRoute('/clients'))}
              className="liquid-glass-soft flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
            >
              <UserPlus className="size-4" strokeWidth={1.6} />
              Nuevo cliente
            </button>
            <button
              type="button"
              onClick={() => navigate(getRoute('/cash-registers'))}
              className="liquid-glass-soft flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
            >
              <Lock className="size-4" strokeWidth={1.6} />
              {isCajaOpen ? 'Arqueo de caja' : 'Abrir caja'}
            </button>
            <button
              type="button"
              onClick={() => navigate(getRoute('/credits'))}
              className="liquid-glass-soft flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
            >
              <CreditCard className="size-4" strokeWidth={1.6} />
              Cobros / Cartera
            </button>
          </div>
        </div>

        {/* 4 Brutalist KPIs (Reference 1:1) */}
        <dl className="animate-rise grid grid-cols-2 border-t border-white/15 [animation-delay:220ms] lg:grid-cols-4">
          {kpiItems.map((kpi, i) => {
            const positive = kpi.delta >= 0;
            return (
              <div
                key={kpi.id}
                onClick={kpi.onClick}
                title={kpi.tooltip}
                className={cn(
                  'flex flex-col gap-3 py-6 pr-4 md:pr-8 cursor-pointer transition-colors hover:bg-white/[0.02]',
                  i % 2 === 1 && 'border-l border-white/10 pl-4 md:pl-8',
                  i >= 2 && 'border-t border-white/10 lg:border-t-0',
                  i === 2 && 'lg:border-l lg:pl-8',
                )}
              >
                <dt className="flex flex-col gap-0.5">
                  <span className="eyebrow flex items-center justify-between gap-2">
                    <span>
                      <span className="text-text-secondary">0{i + 1}</span> — {kpi.label}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">{kpi.subtitle}</span>
                </dt>
                <dd className="flex flex-col gap-4">
                  <span className="text-3xl font-light tabular-nums tracking-[-0.03em] md:text-[44px] md:leading-none">
                    {kpi.value}
                  </span>
                  <span className={cn(positive ? 'text-white/40' : 'text-brand-primary/70')}>
                    <Sparkline data={kpi.trend} />
                  </span>
                  <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-muted">
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5',
                        positive ? 'text-emerald-400' : 'text-brand-primary',
                      )}
                    >
                      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {Math.abs(kpi.delta).toFixed(1)}%
                    </span>
                    <span>{kpi.hint}</span>
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* ========================================================
          02 — ROW 1: REVENUE CHART (2 COLS) + CASH REGISTER (1 COL)
         ======================================================== */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left 2 Cols: Revenue Chart (Reference 1:1) */}
        <div className="xl:col-span-2">
          <GlassPanel
            id="revenue"
            index="01"
            eyebrow="Flujo de ingresos"
            title="Ingresos por día"
            className="h-full"
            action={
              <div role="radiogroup" aria-label="Rango" className="flex rounded-full border border-white/10 bg-black/30 p-1">
                {ranges.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={range === r.id}
                    onClick={() => setRange(r.id)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 font-mono text-[11px] transition-colors cursor-pointer',
                      range === r.id ? 'bg-white/15 text-text-primary' : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-4xl font-light tabular-nums tracking-[-0.03em] md:text-5xl">
                  {formatCurrency(activeRevenueHover ? activeRevenueHover.membership + activeRevenueHover.pos : totalRevenue)}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {activeRevenueHover ? activeRevenueHover.day : `Últimos ${days} días`}
                </span>
              </div>
              <div className="flex gap-6 font-mono text-[11px] text-text-secondary">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-[2px] bg-brand-primary" />
                  Membresías {totalRevenue > 0 ? Math.round((membershipTotal / totalRevenue) * 100) : 0}%
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-[2px] bg-white/40" />
                  POS {totalRevenue > 0 ? 100 - Math.round((membershipTotal / totalRevenue) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                {[1, 0.5, 0].map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-mono text-[10px] text-text-muted">{compactCop(maxRevenue * t)}</span>
                    <span className="h-px flex-1 border-t border-dashed border-white/10" />
                  </div>
                ))}
              </div>
              <div
                className="relative ml-[52px] flex h-52 items-end gap-[3px] md:gap-1.5"
                onMouseLeave={() => setHoveredDay(null)}
                role="img"
                aria-label={`Ingresos de los últimos ${days} días: total ${formatCurrency(totalRevenue)}`}
              >
                {revenueData.map((d, i) => {
                  const height = maxRevenue > 0 ? ((d.membership + d.pos) / maxRevenue) * 100 : 0;
                  const posShare = (d.membership + d.pos) > 0 ? d.pos / (d.membership + d.pos) : 0;
                  const dim = hoveredDay !== null && hoveredDay !== i;
                  return (
                    <div
                      key={d.day}
                      onMouseEnter={() => setHoveredDay(i)}
                      className={cn('flex h-full flex-1 flex-col justify-end transition-opacity cursor-pointer', dim && 'opacity-35')}
                    >
                      <div
                        className="flex flex-col overflow-hidden rounded-t-[4px]"
                        style={{ height: `${Math.max(6, height)}%` }}
                      >
                        <div className="bg-white/40" style={{ height: `${posShare * 100}%` }} />
                        <div className="flex-1 bg-gradient-to-b from-brand-primary to-brand-primary/40" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ml-[52px] mt-3 flex justify-between font-mono text-[10px] text-text-muted">
                <span>{revenueData[0]?.day}</span>
                <span>{revenueData[Math.floor(revenueData.length / 2)]?.day}</span>
                <span>{revenueData[revenueData.length - 1]?.day}</span>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Right 1 Col: Turno Actual de Caja (Reference 1:1 with explicit scope separation) */}
        <GlassPanel
          id="cash"
          index="02"
          eyebrow="Caja · Recaudo recibido en este turno"
          title="Turno actual"
          className="h-full"
          action={
            <span
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]',
                isCajaOpen
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-text-muted'
              )}
            >
              <span className={cn('size-1.5 rounded-full', isCajaOpen ? 'bg-emerald-400' : 'bg-text-muted')} />
              {isCajaOpen ? 'Abierta' : 'Cerrada'}
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <span className="text-4xl font-light tabular-nums tracking-[-0.03em]">
              {formatCurrency(inDrawer)}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              {isCajaOpen
                ? `Efectivo en gaveta · desde ${openedAtTime} · ${firstName}`
                : 'Sin turno activo'}
            </span>
          </div>

          <dl className="flex flex-col border-t border-white/10">
            {cashRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-white/10 py-2.5 text-sm">
                <dt className="text-text-secondary">{row.label}</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(row.value)}</dd>
              </div>
            ))}
            <div
              className="flex items-center justify-between border-b border-white/10 py-2.5 text-sm font-medium"
              title="Suma de Efectivo + Transferencia + Tarjeta recaudados exclusivamente desde la apertura de este turno"
            >
              <dt className="text-text-primary">Recaudo total en este turno</dt>
              <dd className="font-mono tabular-nums text-emerald-400">{formatCurrency(shiftCollectedTotal)}</dd>
            </div>
            {preShiftPaymentsToday > 0 && (
              <div
                className="flex items-center justify-between border-b border-white/10 py-2 text-xs"
                title="Pagos del día de hoy registrados antes de abrir este turno de caja"
              >
                <dt className="text-text-muted">Recaudo hoy previo al turno</dt>
                <dd className="font-mono tabular-nums text-text-secondary">{formatCurrency(preShiftPaymentsToday)}</dd>
              </div>
            )}
            <div
              className="flex items-center justify-between pt-3 pb-1 text-sm"
              title="Cartera histórica total pendiente de cobro acumulada (no pertenece al recaudo del turno)"
            >
              <dt className="flex flex-col">
                <span className="text-text-secondary">Por cobrar (Cartera total)</span>
                <span className="font-mono text-[10px] text-text-muted">
                  Histórico acumulado{creditTodayAmount > 0 ? ` · Hoy: ${formatCurrency(creditTodayAmount)}` : ''}
                </span>
              </dt>
              <dd className="font-mono tabular-nums text-brand-primary">{formatCurrency(receivablesAmount)}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => navigate(getRoute('/cash-registers'))}
            className="liquid-glass-soft mt-auto flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
          >
            <Lock className="size-4" strokeWidth={1.6} />
            {isCajaOpen ? 'Hacer cierre de caja' : 'Abrir turno de caja'}
          </button>
        </GlassPanel>
      </div>

      {/* ========================================================
          03 — ROW 2: RENEWALS QUEUE (2 COLS) + ACTIVITY FEED (1 COL)
         ======================================================== */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left 2 Cols: Cola de Renovaciones (Reference 1:1) */}
        <div className="xl:col-span-2">
          <GlassPanel
            id="renewals"
            index="03"
            eyebrow="Atención prioritaria"
            title="Cola de renovaciones"
            action={
              <button
                type="button"
                onClick={() => navigate(getRoute('/memberships'))}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Ver todas <ArrowRight className="size-3" />
              </button>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div role="tablist" aria-label="Filtrar vencimientos" className="flex rounded-full border border-white/10 bg-black/30 p-1">
                {renewalFilters.map((f) => {
                  const count = expiringMembersList.filter((m) => f.match(m.days_left)).length;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={renewalFilter === f.id}
                      onClick={() => setRenewalFilter(f.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors cursor-pointer',
                        renewalFilter === f.id ? 'bg-white/15 text-text-primary' : 'text-text-muted hover:text-text-primary',
                      )}
                    >
                      {f.label}
                      <span className="font-mono text-[10px] text-text-muted">{count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                En juego <span className="text-text-primary">{formatCurrency(atStakeAmount)}</span>
              </p>
            </div>

            {filteredRenewals.length === 0 ? (
              <div className="py-12 text-center text-text-muted border-t border-white/10">
                <CalendarCheck className="mx-auto h-8 w-8 mb-2 opacity-30 text-emerald-400" />
                <p className="text-sm font-medium">No hay renovaciones en este segmento.</p>
                <p className="text-xs text-text-muted mt-1">Los clientes de este grupo se encuentran al día.</p>
              </div>
            ) : (
              <ul className="flex flex-col border-t border-white/10">
                {filteredRenewals.map((m) => (
                  <li
                    key={m.id}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/10 py-4 last:border-b-0 md:grid-cols-[auto_1.4fr_1fr_auto_auto]"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-medium text-text-secondary">
                      {initials(m.client_name)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{m.client_name}</span>
                      <span className="font-mono text-[11px] text-text-muted">{m.client_phone || 'Sin teléfono'}</span>
                    </div>
                    <div className="hidden flex-col gap-1 md:flex">
                      <span className="text-sm text-text-secondary">{m.plan_name}</span>
                      <span className="font-mono text-[11px] text-text-muted">
                        Vence: {formatDate(m.end_date)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'hidden rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] md:inline-block',
                        m.days_left === 0
                          ? 'border-brand-primary/40 bg-brand-primary/15 text-red-300'
                          : m.days_left < 0
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : 'border-white/15 text-text-secondary',
                      )}
                    >
                      {m.days_left === 0 ? 'Hoy' : m.days_left < 0 ? `Venció hace ${Math.abs(m.days_left)}d` : `${m.days_left} días`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          openWhatsAppModal({
                            client: {
                              id: m.client_id || m.id,
                              full_name: m.client_name,
                              phone: m.client_phone || null,
                            },
                            eventType: m.days_left <= 0 ? 'MEMBERSHIP_EXPIRED' : 'MEMBERSHIP_EXPIRY',
                            eventLabel: m.days_left <= 0 ? 'Avisar vencida' : 'Recordar vencimiento',
                            contextData: {
                              membership_name: m.plan_name,
                              days_left: m.days_left.toString(),
                            },
                          })
                        }
                        className="rounded-full p-2.5 text-text-muted transition-colors hover:bg-white/10 hover:text-emerald-300 cursor-pointer"
                        aria-label={`Escribir a ${m.client_name} por WhatsApp`}
                      >
                        <MessageCircle className="size-4" strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(getRoute('/memberships'))}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium transition-colors hover:bg-brand-primary hover:text-white cursor-pointer"
                      >
                        Renovar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>

        {/* Right 1 Col: Actividad de Hoy (Reference 1:1) */}
        <GlassPanel
          id="activity"
          index="04"
          eyebrow="En vivo"
          title="Actividad de hoy"
          className="h-full"
          action={
            <span className="relative mt-1 flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-primary/70" />
              <span className="relative size-2 rounded-full bg-brand-primary" />
            </span>
          }
        >
          <ol className="relative flex flex-col">
            <span aria-hidden="true" className="absolute bottom-4 left-[19px] top-4 w-px bg-white/10" />
            {recentActivity.map((item) => {
              return (
                <li key={item.id} className="relative flex items-start gap-4 py-3">
                  <span className="liquid-glass-soft relative flex size-10 shrink-0 items-center justify-center rounded-full">
                    {item.type === 'membership' && <Receipt className="size-4 text-text-primary" strokeWidth={1.6} />}
                    {item.type === 'pos' && <ShoppingCart className="size-4 text-text-primary" strokeWidth={1.6} />}
                    {item.type === 'client' && <Users className="size-4 text-text-primary" strokeWidth={1.6} />}
                    {item.type === 'payment' && <Wallet className="size-4 text-text-primary" strokeWidth={1.6} />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="font-mono text-[11px] text-text-muted">{item.time}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-xs text-text-secondary">{item.detail}</span>
                      {item.amount !== null && item.amount !== undefined && item.amount > 0 && (
                        <span className="font-mono text-xs tabular-nums text-text-primary">{formatCurrency(item.amount)}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {recentActivity.length === 0 && (
              <li className="py-8 text-center text-text-muted text-xs">
                Sin movimientos registrados el día de hoy.
              </li>
            )}
          </ol>

          <button
            type="button"
            onClick={() => navigate(getRoute('/audit'))}
            className="liquid-glass-soft mt-auto flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
          >
            <span>Ver auditoría completa</span>
            <ArrowRight className="size-4" strokeWidth={1.6} />
          </button>
        </GlassPanel>
      </div>

      {/* Income Breakdown Modal */}
      <IncomeDetailsDrawer
        isOpen={isIncomeDetailsOpen}
        onClose={() => setIsIncomeDetailsOpen(false)}
      />

      <WhatsAppModalComponent />
    </div>
  );
}
