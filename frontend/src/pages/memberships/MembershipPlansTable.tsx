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
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface-panel/80 rounded-[var(--radius-xl)] border border-border-subtle border-dashed">
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
    <div className="w-full overflow-x-auto rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/90 shadow-subtle backdrop-blur-md">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-surface-raised/70 text-text-muted border-b border-border-subtle tracking-wider font-semibold">
          <tr>
            <th scope="col" className="px-6 py-3.5">Plan</th>
            <th scope="col" className="px-6 py-3.5">Precio</th>
            <th scope="col" className="px-6 py-3.5">Duración</th>
            <th scope="col" className="px-6 py-3.5">Estado</th>
            <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {plans.map((plan) => (
            <tr 
              key={plan.id} 
              className={cn("hover:bg-surface-panel-hover transition-colors group", !plan.is_active && "opacity-50")}
            >
              <td className="px-6 py-3.5">
                <div className="font-semibold text-text-primary">{plan.name}</div>
                {plan.description && <div className="text-xs text-text-muted truncate max-w-[200px]">{plan.description}</div>}
              </td>
              <td className="px-6 py-3.5 font-medium text-text-primary">
                {formatPrice(plan.price)}
              </td>
              <td className="px-6 py-3.5">
                {plan.duration_days} días
              </td>
              <td className="px-6 py-3.5">
                {plan.is_active ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(plan)}
                    className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    title="Editar Plan"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => onToggleStatus(plan)}
                    className={cn(
                      "p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                      plan.is_active 
                        ? "text-text-muted hover:text-rose-400 hover:bg-rose-500/10" 
                        : "text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                    )}
                    title={plan.is_active ? "Desactivar Plan" : "Reactivar Plan"}
                  >
                    <Ban size={15} />
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
