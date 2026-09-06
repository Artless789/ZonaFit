import { useQuery } from '@tanstack/react-query';
import { Building2, Users, AlertCircle, ShieldAlert, CreditCard, DollarSign, Activity } from 'lucide-react';
import { Skeleton } from '@shared/ui/Skeleton';
import { superadminService } from '../../services/superadminService';
import { Badge } from '@shared/ui/Badge';
import { formatCurrency } from '@shared/utils/formatters';

export function SuperadminDashboard() {
  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: superadminService.getDashboardMetrics,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">
          No se pudieron cargar las métricas globales.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Overview</h1>
        <p className="text-text-secondary text-sm mt-1">Métricas globales de la plataforma ZonaFit.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Gimnasios Totales</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.total_gyms}</div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Building2 className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Gimnasios Activos</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.active_gyms}</div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Pendientes de Onboarding</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.pending_onboarding_gyms}</div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Users className="w-6 h-6 text-info" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Usuarios Totales</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.total_users}</div>
        </div>
        
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <Building2 className="w-6 h-6 text-danger" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Gimnasios Inactivos</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.inactive_gyms}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <CreditCard className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Suscripciones Activas</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.active_subscriptions}</div>
        </div>
        
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg">
              <Activity className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Suscripciones en Trial</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.trial_subscriptions}</div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Suscripciones Vencidas</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics?.expired_subscriptions}</div>
        </div>
        
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-sm font-semibold text-text-secondary">Ingresos Registrados</h3>
          </div>
          <div className="text-3xl font-bold text-text-primary">
            {metrics?.total_revenue != null 
              ? formatCurrency(metrics.total_revenue)
              : '$0'}
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Información del Sistema</h2>
        <div className="flex items-center justify-between py-2 border-b border-border-light">
          <span className="text-text-secondary text-sm">Superadministradores Registrados</span>
          <Badge variant="info">{metrics?.total_superadmins}</Badge>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border-light">
          <span className="text-text-secondary text-sm">Planes Comerciales Activos</span>
          <Badge variant="success">{metrics?.active_plans}</Badge>
        </div>
      </div>
    </div>
  );
}
