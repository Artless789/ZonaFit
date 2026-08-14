import { Link, useNavigate } from 'react-router-dom';
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
  UserCheck
} from 'lucide-react';
import { GlassCard } from '../../components/shared/GlassCard';
import { Skeleton } from '../../components/shared/Skeleton';
import { ErrorState } from '../../components/shared/ErrorState';
import { SubscriptionStatusBanner } from '../../components/shared/SubscriptionStatusBanner';
import { useDashboard } from '../../hooks/useDashboard';
import { Badge } from '../../components/shared/Badge';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { Button } from '../../components/shared/Button';
import { DashboardActivity } from '../../types/dashboard';

const formatCurrency = (value: number | string | null | undefined) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export function DashboardPage() {
  const navigate = useNavigate();
  const dashboard = useDashboard();
  const data = dashboard.data;

  if (dashboard.isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-32 w-full" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-96 w-full xl:col-span-2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Ventas de hoy',
      value: formatCurrency(data?.sales_today_amount),
      detail: `${data?.sales_today || 0} transacciones`,
      icon: ShoppingCart,
      tone: 'text-brand-primary bg-brand-primary/10',
      link: '/sales'
    },
    {
      label: 'Ingresos del mes',
      value: formatCurrency(data?.income_this_month),
      detail: 'Pagos recibidos',
      icon: CircleDollarSign,
      tone: 'text-success bg-success/10',
      link: '/reports'
    },
    {
      label: 'Clientes activos',
      value: data?.active_clients ?? 0,
      detail: 'Afiliados con acceso',
      icon: Users,
      tone: 'text-info bg-info/10',
      link: '/clients'
    },
    {
      label: 'Membresías por vencer',
      value: data?.expiring_memberships_count ?? 0,
      detail: 'En los próximos 7 días',
      icon: CalendarCheck,
      tone: 'text-warning bg-warning/10',
      link: '/memberships'
    },
    {
      label: 'Total por cobrar',
      value: formatCurrency(data?.total_receivables),
      detail: 'Cartera pendiente',
      icon: Wallet,
      tone: 'text-brand-primary bg-brand-primary/10',
      link: '/credits'
    },
    {
      label: 'Créditos vencidos',
      value: formatCurrency(data?.overdue_receivables),
      detail: 'Cuentas en mora',
      icon: TriangleAlert,
      tone: 'text-danger bg-danger/10',
      link: '/credits'
    },
  ];

  const getActivityIcon = (type: DashboardActivity['type']) => {
    switch(type) {
      case 'SALE': return <ShoppingCart size={16} className="text-brand-primary" />;
      case 'MEMBERSHIP': return <ClipboardList size={16} className="text-info" />;
      case 'CLIENT': return <UserPlus size={16} className="text-success" />;
      case 'PAYMENT': return <CreditCard size={16} className="text-warning" />;
      default: return <Clock size={16} className="text-text-muted" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-8 font-sans">
      <SubscriptionStatusBanner />
      
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Centro de Operaciones</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Consulta el estado de tu gimnasio y prioriza las tareas que requieren atención.
          </p>
        </div>
        <ActionGlowButton onClick={() => navigate('/sales')} className="px-5 py-2.5 text-sm h-auto flex items-center gap-2">
          Punto de Venta <ShoppingCart size={16} />
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
          {/* KPI Superiores */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores principales">
            {metrics.map(({ label, value, detail, icon: Icon, tone, link }) => (
              <GlassCard key={label} className="p-5 flex flex-col justify-between hover:border-brand-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text-secondary">{label}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{value}</p>
                    <p className="mt-1 text-xs text-text-muted">{detail}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon size={21} aria-hidden="true" />
                  </div>
                </div>
                <Link to={link} className="mt-4 flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-primary transition-colors">
                  Ver detalle <ArrowRight size={14} />
                </Link>
              </GlassCard>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            
            {/* Actividad de Hoy */}
            <GlassCard className="p-6 xl:col-span-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface border border-border-light text-brand-primary">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Actividad de Hoy</h2>
                  <p className="text-xs text-text-muted">Línea de tiempo de operaciones</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-muted">
                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">No hay actividad registrada en el día de hoy.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.recent_activity.map((activity, idx) => (
                      <div key={activity.id} className="relative pl-6 pb-4">
                        {idx !== data.recent_activity.length - 1 && (
                          <div className="absolute left-2.5 top-5 bottom-[-16px] w-[2px] bg-border-light"></div>
                        )}
                        <div className="absolute left-[3px] top-1.5 w-4 h-4 rounded-full bg-surface-dark border border-border-light flex items-center justify-center z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/50"></div>
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary">{activity.title}</span>
                              {getActivityIcon(activity.type)}
                            </div>
                            <p className="text-xs text-text-secondary mt-1">{activity.subtitle}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-text-muted font-medium">{formatTime(activity.created_at)}</span>
                            {activity.amount != null && (
                              <p className="text-sm font-bold text-text-primary mt-1">{formatCurrency(activity.amount)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>

            <div className="xl:col-span-2 flex flex-col gap-6">
              
              {/* Membresías por Vencer */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                      <TriangleAlert size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">Membresías que requieren atención</h2>
                      <p className="text-xs text-text-muted">Próximas a vencer en 7 días</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => navigate('/memberships')} className="text-xs px-3 py-1.5">
                    Ver todas
                  </Button>
                </div>
                
                {(!data?.expiring_memberships || data.expiring_memberships.length === 0) ? (
                  <div className="text-center py-6 text-text-muted text-sm">
                    No existen membresías próximas a vencer.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Cliente</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Plan</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Vencimiento</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.expiring_memberships.map((mem) => (
                          <tr key={mem.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3 text-sm font-medium text-text-primary">{mem.client_name}</td>
                            <td className="py-3 text-sm text-text-secondary">{mem.plan_name}</td>
                            <td className="py-3 text-sm">
                              {mem.days_left === 0 ? (
                                <Badge variant="danger">Vence hoy</Badge>
                              ) : (
                                <Badge variant="warning">En {mem.days_left} días</Badge>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <Link to={`/memberships`} className="text-xs font-medium text-brand-primary hover:text-brand-primary-hover opacity-0 group-hover:opacity-100 transition-opacity">
                                Renovar <ArrowRight size={12} className="inline" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

              {/* Cartera Pendiente */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">Cartera Pendiente</h2>
                      <p className="text-xs text-text-muted">Cuentas por cobrar y saldos vencidos</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => navigate('/credits')} className="text-xs px-3 py-1.5">
                    Ir a Créditos
                  </Button>
                </div>

                {(!data?.receivables || data.receivables.length === 0) ? (
                  <div className="text-center py-6 text-text-muted text-sm">
                    No hay cuentas por cobrar pendientes.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Cliente</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Saldo</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Estado</th>
                          <th className="pb-3 text-xs font-semibold text-text-muted uppercase text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.receivables.map((rec) => (
                          <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3 text-sm font-medium text-text-primary flex items-center gap-2">
                              <UserCheck size={14} className="text-text-muted" /> {rec.client_name}
                            </td>
                            <td className="py-3 text-sm font-bold text-text-primary">{formatCurrency(rec.balance_due)}</td>
                            <td className="py-3 text-sm">
                              {rec.days_overdue > 0 ? (
                                <Badge variant="danger">Vencido ({rec.days_overdue}d)</Badge>
                              ) : (
                                <Badge variant="default">Pendiente</Badge>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <Link to={`/credits`} className="text-xs font-medium text-brand-primary hover:text-brand-primary-hover opacity-0 group-hover:opacity-100 transition-opacity">
                                Abonar <ArrowRight size={12} className="inline" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
