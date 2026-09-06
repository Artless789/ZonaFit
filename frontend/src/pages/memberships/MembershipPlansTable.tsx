import { Edit2, Tag, Ban } from 'lucide-react';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';
import { formatCurrency } from '@shared/utils/formatters';

interface MembershipPlansTableProps {
  plans: MembershipPlan[];
  onEdit: (plan: MembershipPlan) => void;
  onToggleStatus: (plan: MembershipPlan) => void;
}

export function MembershipPlansTable({ plans, onEdit, onToggleStatus }: MembershipPlansTableProps) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <Tag className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No hay planes registrados</h3>
        <p className="text-text-secondary max-w-sm">
          Crea tu primer plan de membresía para empezar a monetizar.
        </p>
      </div>
    );
  }

  const formatPrice = formatCurrency;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Plan</th>
            <th scope="col" className="px-6 py-4 font-semibold">Precio</th>
            <th scope="col" className="px-6 py-4 font-semibold">Duración</th>
            <th scope="col" className="px-6 py-4 font-semibold">Estado</th>
            <th scope="col" className="px-6 py-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {plans.map((plan) => (
            <tr 
              key={plan.id} 
              className={cn("hover:bg-bg-elevated/30 transition-colors group", !plan.is_active && "opacity-50")}
            >
              <td className="px-6 py-4">
                <div className="font-semibold text-text-primary">{plan.name}</div>
                {plan.description && <div className="text-xs text-text-muted truncate max-w-[200px]">{plan.description}</div>}
              </td>
              <td className="px-6 py-4 font-medium text-text-primary">
                {formatPrice(plan.price)}
              </td>
              <td className="px-6 py-4">
                {plan.duration_days} días
              </td>
              <td className="px-6 py-4">
                {plan.is_active ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(plan)}
                    className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                    title="Editar Plan"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onToggleStatus(plan)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      plan.is_active 
                        ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                        : "text-text-muted hover:text-success hover:bg-success/10"
                    )}
                    title={plan.is_active ? "Desactivar Plan" : "Reactivar Plan"}
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
