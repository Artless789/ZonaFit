import { Ban, CheckCircle2, UserCheck, Clock } from 'lucide-react';
import type { Membership } from '../../types/membership';
import { Badge } from '../../components/shared/Badge';
import { cn } from '../../utils/cn';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

export type EnrichedMembership = Membership & { 
  clientName: string; 
  planName: string; 
};

interface MembershipsTableProps {
  memberships: EnrichedMembership[];
  onToggleStatus: (membership: Membership) => void;
}

export function MembershipsTable({ memberships, onToggleStatus }: MembershipsTableProps) {
  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Sin suscripciones activas</h3>
        <p className="text-text-secondary max-w-sm">
          Asigna un plan de membresía a un cliente para que aparezca aquí.
        </p>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d 'de' MMM, yyyy", { locale: es });
    } catch {
      return isoString;
    }
  };

  const renderStatus = (status: string, is_active: boolean) => {
    if (!is_active) return <Badge variant="danger">Cancelada</Badge>;
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="success">Activa</Badge>;
      case 'EXPIRED':
        return <Badge variant="warning">Expirada</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Cliente</th>
            <th scope="col" className="px-6 py-4 font-semibold">Plan Asignado</th>
            <th scope="col" className="px-6 py-4 font-semibold">Vigencia</th>
            <th scope="col" className="px-6 py-4 font-semibold">Precio Cobrado</th>
            <th scope="col" className="px-6 py-4 font-semibold">Estado</th>
            <th scope="col" className="px-6 py-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {memberships.map((membership) => (
            <tr 
              key={membership.id} 
              className={cn("hover:bg-bg-elevated/30 transition-colors group", !membership.is_active && "opacity-50")}
            >
              <td className="px-6 py-4">
                <div className="font-semibold text-text-primary">{membership.clientName}</div>
                <div className="text-xs text-text-muted">ID: {membership.client_id}</div>
              </td>
              <td className="px-6 py-4">
                <div className="font-medium text-brand-primary">{membership.planName}</div>
                {membership.trainer_name && (
                  <div className="text-xs text-text-muted mt-0.5">Entrenador: {membership.trainer_name}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 size={12} />
                    <span>{formatDate(membership.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-danger">
                    <Clock size={12} />
                    <span>{formatDate(membership.end_date)}</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 font-medium text-text-primary">
                {formatPrice(membership.price)}
              </td>
              <td className="px-6 py-4">
                {renderStatus(membership.status, membership.is_active)}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onToggleStatus(membership)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      membership.is_active 
                        ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                        : "text-text-muted hover:text-success hover:bg-success/10"
                    )}
                    title={membership.is_active ? "Cancelar Suscripción" : "Reactivar Suscripción"}
                  >
                    <Ban size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
