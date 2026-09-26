import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  ShoppingCart,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  Clock,
  CalendarCheck,
  CreditCard,
  UserCheck,
  MessageCircle,
} from 'lucide-react';

import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { SubscriptionStatusBanner } from '@shared/ui/SubscriptionStatusBanner';
import { useDashboard } from '../../hooks/useDashboard';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { formatCurrency } from '@shared/utils/formatters';
import { Badge } from '@shared/ui/Badge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Button } from '@shared/ui/Button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';
import { DashboardActivity } from '@shared/types/dashboard';
import { IncomeDetailsDrawer } from './IncomeDetailsDrawer';

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Ayer, ${timeStr}`;
  return `${date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${timeStr}`;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const getRoute = (path: string) => (isDemo ? `/demo${path}` : path);
  const [isIncomeDetailsOpen, setIsIncomeDetailsOpen] = useState(false);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const dashboard = useDashboard();
  const data = dashboard.data;

  if (dashboard.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64 rounded-radius-md" />
          <Skeleton className="h-4 w-80 rounded-radius-sm" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 w-full rounded-radius-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 w-full lg:col-span-2 rounded-radius-xl" />
          <Skeleton className="h-96 w-full rounded-radius-xl" />
        </div>
      </div>
    );
  }

  const getActivityIcon = (type: DashboardActivity['type']) => {
    switch (type) {
      case 'SALE':
        return <ShoppingCart size={15} className="text-brand-primary" />;
      case 'MEMBERSHIP':
        return <ClipboardList size={15} className="text-info" />;
      case 'CLIENT':
        return <UserPlus size={15} className="text-success" />;
      case 'PAYMENT':
        return <CreditCard size={15} className="text-warning" />;
      default:
        return <Clock size={15} className="text-text-muted" />;
    }
  };

  return (
    <div className="flex flex-col gap-7 pb-8 font-sans">
      <SubscriptionStatusBanner />

      {/* Header Editorial Context */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" aria-hidden="true" />
            <span className="text-[0.6875rem] font-semibold tracking-wider text-text-muted uppercase">
              Centro de Operaciones
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Estado General
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Visión ejecutiva y tareas prioritarias para la operación de tu gimnasio.
          </p>
        </div>

        <ActionGlowButton
          onClick={() => navigate(getRoute('/sales'))}
          className="self-start sm:self-auto flex items-center gap-2"
        >
          <ShoppingCart size={16} />
          <span>Punto de Venta</span>
        </ActionGlowButton>
      </div>

      {dashboard.isError && !data ? (
        <ErrorState
          title="Error al cargar el dashboard"
          error={dashboard.error}
          onRetry={() => dashboard.refetch()}
        />
      ) : (
        <>
          {/* Primary Summary — Editorial Metric Grid */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores principales">
            {/* Hero Metric 1: Ingresos del Mes */}
            <div
              onClick={() => setIsIncomeDetailsOpen(true)}
              className="xl:col-span-2 cursor-pointer group rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-5 shadow-subtle hover:border-emerald-500/40 hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-text-muted">Ingresos del Mes</span>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary group-hover:text-emerald-400 transition-colors">
                    {formatCurrency(data?.income_this_month)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">Pagos acumulados recibidos</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CircleDollarSign size={20} aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                <span>Ver desglose y gráficas</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Hero Metric 2: Ventas de Hoy */}
            <div
              onClick={() => navigate(getRoute('/sales'))}
              className="xl:col-span-2 cursor-pointer group rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-5 shadow-subtle hover:border-brand-primary/40 hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-text-muted">Ventas de Hoy</span>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary group-hover:text-brand-primary transition-colors">
                    {formatCurrency(data?.sales_today_amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{data?.sales_today || 0} transacciones completadas</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                  <ShoppingCart size={20} aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold text-brand-primary group-hover:translate-x-0.5 transition-transform">
                <span>Ir al punto de venta</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Supporting Metric 1: Clientes Activos */}
            <div
              onClick={() => navigate(getRoute('/clients'))}
              className="cursor-pointer group rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-4.5 shadow-subtle hover:border-border-strong hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-text-muted">Clientes Activos</span>
                  <p className="mt-1 text-xl font-bold tracking-tight text-text-primary">
                    {data?.active_clients ?? 0}
                  </p>
                </div>
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[var(--radius-sm)] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users size={16} />
                </div>
              </div>
              <span className="mt-2 text-[0.6875rem] text-text-muted group-hover:text-text-secondary transition-colors">
                Afiliados vigentes
              </span>
            </div>

            {/* Supporting Metric 2: Membresías por Vencer */}
            <div
              onClick={() => navigate(getRoute('/memberships'))}
              className="cursor-pointer group rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-4.5 shadow-subtle hover:border-amber-500/40 hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-text-muted">Por Vencer</span>
                  <p className="mt-1 text-xl font-bold tracking-tight text-amber-400">
                    {data?.expiring_memberships_count ?? 0}
                  </p>
                </div>
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[var(--radius-sm)] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <CalendarCheck size={16} />
                </div>
              </div>
              <span className="mt-2 text-[0.6875rem] text-text-muted group-hover:text-text-secondary transition-colors">
                Próximos 7 días
              </span>
            </div>
          </section>

          {/* Main Operational Split */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Primary Operations Column (Left 2 cols) */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              
              {/* Membresías por Vencer */}
              <div className="rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-5 sm:p-6 shadow-subtle">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <TriangleAlert size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">Membresías por Vencer</h2>
                      <p className="text-xs text-text-muted">Atención prioritaria en los próximos 7 días</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(getRoute('/memberships'))}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Ver todas
                  </Button>
                </div>

                {!data?.expiring_memberships || data.expiring_memberships.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-xs">
                    No existen membresías próximas a vencer en este período.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-light">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expiring_memberships.map((mem) => (
                          <TableRow key={mem.id}>
                            <TableCell className="font-medium text-text-primary">{mem.client_name}</TableCell>
                            <TableCell>{mem.plan_name}</TableCell>
                            <TableCell>
                              {mem.days_left === 0 ? (
                                <Badge variant="danger">Vence hoy</Badge>
                              ) : (
                                <Badge variant="warning">En {mem.days_left} días</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openWhatsAppModal({
                                      client: {
                                        id: mem.client_id || mem.id,
                                        full_name: mem.client_name,
                                        phone: mem.client_phone || null,
                                      },
                                      eventType: mem.days_left === 0 ? 'MEMBERSHIP_EXPIRED' : 'MEMBERSHIP_EXPIRY',
                                      eventLabel: mem.days_left === 0 ? 'Avisar vencida' : 'Recordar vencimiento',
                                      contextData: {
                                        membership_name: mem.plan_name,
                                        days_left: mem.days_left.toString(),
                                      },
                                    })
                                  }
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center justify-center cursor-pointer"
                                  title="WhatsApp"
                                >
                                  <MessageCircle size={15} />
                                </button>
                                <Link
                                  to={getRoute('/memberships')}
                                  className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors"
                                >
                                  Renovar
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Cartera Pendiente */}
              <div className="rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-5 sm:p-6 shadow-subtle">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">Cartera Pendiente</h2>
                      <p className="text-xs text-text-muted">Cuentas por cobrar y saldos vencidos</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(getRoute('/credits'))}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Ir a Créditos
                  </Button>
                </div>

                {!data?.receivables || data.receivables.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-xs">
                    No hay cuentas por cobrar pendientes en este momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-light">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.receivables.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="font-medium text-text-primary flex items-center gap-2">
                              <UserCheck size={14} className="text-text-muted" />
                              <span>{rec.client_name}</span>
                            </TableCell>
                            <TableCell className="font-semibold text-text-primary">
                              {formatCurrency(rec.balance_due)}
                            </TableCell>
                            <TableCell>
                              {rec.days_overdue > 0 ? (
                                <Badge variant="danger">Vencido ({rec.days_overdue}d)</Badge>
                              ) : (
                                <Badge variant="default">Pendiente</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openWhatsAppModal({
                                      client: {
                                        id: rec.client_id || rec.id,
                                        full_name: rec.client_name,
                                        phone: rec.client_phone || null,
                                      },
                                      eventType: 'CREDIT_OVERDUE',
                                      eventLabel: 'Recordar saldo',
                                      contextData: {
                                        balance_due: formatCurrency(rec.balance_due),
                                        amount: formatCurrency(rec.balance_due),
                                      },
                                    })
                                  }
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center justify-center cursor-pointer"
                                  title="Avisar por WhatsApp"
                                >
                                  <MessageCircle size={15} />
                                </button>
                                <Link
                                  to={getRoute('/credits')}
                                  className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors"
                                >
                                  Abonar
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

            </div>

            {/* Activity Timeline Column (Right 1 col) */}
            <div className="rounded-[var(--radius-xl)] border border-border-light bg-surface-panel p-5 sm:p-6 shadow-subtle flex flex-col h-full max-h-[700px]">
              <div className="flex items-center gap-3 mb-5 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Actividad Reciente</h2>
                  <p className="text-xs text-text-muted">Operaciones registradas hoy</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {!data?.recent_activity || data.recent_activity.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-text-muted">
                    <Clock className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-xs">No hay actividad registrada el día de hoy.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.recent_activity.map((activity, idx) => (
                      <div key={activity.id} className="relative pl-6 pb-2">
                        {idx !== data.recent_activity.length - 1 && (
                          <div className="absolute left-2.5 top-5 -bottom-2 w-px bg-border-light" />
                        )}
                        <div className="absolute left-1 top-1.5 w-3.5 h-3.5 rounded-full bg-surface-raised border border-border-medium flex items-center justify-center z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-text-primary">{activity.title}</span>
                              {getActivityIcon(activity.type)}
                            </div>
                            <p className="text-[0.6875rem] text-text-secondary mt-0.5">{activity.subtitle}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[0.65rem] text-text-muted font-medium">
                              {formatTime(activity.created_at)}
                            </span>
                            {activity.amount != null && (
                              <p className="text-xs font-bold text-text-primary mt-0.5">
                                {formatCurrency(activity.amount)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      <IncomeDetailsDrawer
        isOpen={isIncomeDetailsOpen}
        onClose={() => setIsIncomeDetailsOpen(false)}
      />

      <WhatsAppModalComponent />
    </div>
  );
}
