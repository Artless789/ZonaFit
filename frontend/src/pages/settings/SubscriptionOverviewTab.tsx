import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../../services/subscriptionService';
import { SUBSCRIPTION_QUERY_KEY } from '@shared/subscription/useLicenseStatus';
import { GlassPanel } from '@shared/ui/GlassPanel';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { 
  Sparkles, 
  Calendar, 
  CreditCard, 
  ArrowUpRight, 
  ShieldCheck, 
  Zap 
} from 'lucide-react';
import { formatDate } from '@shared/utils/formatters';

export function SubscriptionOverviewTab() {
  const { data: subscription } = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionService.getMySubscription,
  });

  const getStatusInfo = () => {
    if (!subscription) {
      return { status: 'neutral' as const, label: 'CARGANDO...' };
    }
    if (subscription.is_lifetime) {
      return { status: 'active' as const, label: 'VITALICIO // LIFETIME' };
    }
    switch (subscription.status) {
      case 'ACTIVE':
        return { status: 'active' as const, label: 'ACTIVA // AL DÍA' };
      case 'TRIAL':
        return { status: 'warning' as const, label: 'PERÍODO DE PRUEBA' };
      case 'PAST_DUE':
        return { status: 'danger' as const, label: 'PAGO PENDIENTE' };
      case 'CANCELLED':
        return { status: 'neutral' as const, label: 'CANCELADA' };
      default:
        return { status: 'neutral' as const, label: subscription.status };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <GlassPanel
        index="01"
        eyebrow="LICENCIA Y FACTURACIÓN SAAS"
        title="Estado de la Suscripción"
        description="Información detallada sobre el plan de servicio contratado, vigencia y métodos de pago de ZonaFit."
        action={
          <StatusBadge status={statusInfo.status} label={statusInfo.label} mode="pill" size="sm" />
        }
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Plan Card */}
          <div className="flex flex-col justify-between p-5 rounded-xl border border-border-medium bg-surface-raised/40">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                Plan Activo
              </span>
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                {subscription?.plan?.name || (subscription?.is_lifetime ? 'Plan Vitalicio' : 'Plan ZonaFit Pro')}
                <Sparkles size={18} className="text-brand-primary" />
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Acceso integral a todos los módulos: POS, Membresías, Caja, Inventario y Reportes.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-border-light flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted">Modalidad:</span>
              <span className="text-text-primary font-semibold">
                {subscription?.is_lifetime ? 'Pago Único' : 'Recurrente'}
              </span>
            </div>
          </div>

          {/* Dates Card */}
          <div className="flex flex-col justify-between p-5 rounded-xl border border-border-light bg-surface-raised/30">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-primary" />
                <span>Vigencia del Servicio</span>
              </span>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Fecha de inicio:</span>
                  <span className="font-mono text-text-primary">
                    {subscription?.starts_at ? formatDate(subscription.starts_at) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Próxima renovación:</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {subscription?.is_lifetime 
                      ? 'Sin vencimiento (Vitalicio)' 
                      : subscription?.ends_at 
                        ? formatDate(subscription.ends_at) 
                        : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border-light flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted">Auto-renovación:</span>
              <span className="text-emerald-400 font-semibold">
                {subscription?.cancellation_requested_at ? 'Cancelación solicitada' : 'Activa'}
              </span>
            </div>
          </div>

          {/* Guarantee / Security Card */}
          <div className="flex flex-col justify-between p-5 rounded-xl border border-border-light bg-surface-raised/30">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} />
                <span>Garantía de Servicio</span>
              </span>
              <p className="text-xs text-text-secondary leading-relaxed">
                Tu información está respaldada con aislamiento multi-inquilino de base de datos y auditoría transaccional continua.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-border-light flex items-center gap-2 text-xs text-text-muted">
              <Zap size={14} className="text-brand-primary" />
              <span>Soporte prioritario 24/7 activo</span>
            </div>
          </div>
        </div>

        {/* Action Link to Full Subscription Page */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border-medium bg-surface-base/60 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-brand-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Gestión Financiera de la Suscripción
              </p>
              <p className="text-xs text-text-muted">
                Consulta el historial de pagos, descarga recibos tributarios oficiales o cambia de plan.
              </p>
            </div>
          </div>

          <Link to="/settings/subscription">
            <ActionGlowButton className="gap-2 shrink-0">
              <span>Panel de Facturación</span>
              <ArrowUpRight size={15} />
            </ActionGlowButton>
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
