import { Edit2, Tag, Ban } from 'lucide-react';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { cn } from '@shared/utils/cn';
import { formatCurrency } from '@shared/utils/formatters';

interface MembershipPlansTableProps {
  plans: MembershipPlan[];
  onEdit: (plan: MembershipPlan) => void;
  onToggleStatus: (plan: MembershipPlan) => void;
}

export function MembershipPlansTable({
  plans,
  onEdit,
  onToggleStatus,
}: MembershipPlansTableProps) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-[24px] border border-dashed border-border-subtle bg-surface-panel/80 shadow-subtle backdrop-blur-md">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 text-brand-primary border border-brand-primary/20">
          <Tag size={30} />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1">
          No hay planes registrados
        </h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Crea tus planes de membresía (mensual, quincenal, anual) para comenzar a afiliar clientes.
        </p>
      </div>
    );
  }

  return (
    <TableContainer className="rounded-[24px] border-border-subtle bg-surface-panel/90 backdrop-blur-md shadow-subtle">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-6 py-3.5">Plan de Membresía</TableHead>
            <TableHead className="px-6 py-3.5">Precio Catálogo</TableHead>
            <TableHead className="px-6 py-3.5 text-center">Duración Cobertura</TableHead>
            <TableHead className="px-6 py-3.5 text-center">Estado</TableHead>
            <TableHead className="px-6 py-3.5 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow
              key={plan.id}
              className={cn(
                'hover:bg-surface-panel-hover transition-colors group',
                !plan.is_active && 'opacity-50'
              )}
            >
              {/* Name & Description */}
              <TableCell className="px-6 py-3.5">
                <div className="font-semibold text-text-primary text-sm">
                  {plan.name}
                </div>
                {plan.description && (
                  <div className="text-xs text-text-muted truncate max-w-xs mt-0.5">
                    {plan.description}
                  </div>
                )}
              </TableCell>

              {/* Price */}
              <TableCell className="px-6 py-3.5 font-mono font-bold text-sm text-brand-primary">
                {formatCurrency(plan.price)}
              </TableCell>

              {/* Duration */}
              <TableCell className="px-6 py-3.5 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-surface-base border border-border-subtle text-text-secondary">
                  {plan.duration_days} {plan.duration_days === 1 ? 'día' : 'días'}
                </span>
              </TableCell>

              {/* Status */}
              <TableCell className="px-6 py-3.5 text-center">
                {plan.is_active ? (
                  <StatusBadge status="active" size="sm" label="Activo" />
                ) : (
                  <StatusBadge status="neutral" size="sm" label="Inactivo" />
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="px-6 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onEdit(plan)}
                    className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    title="Editar Plan"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(plan)}
                    className={cn(
                      'p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer',
                      plan.is_active
                        ? 'text-text-muted hover:text-rose-400 hover:bg-rose-500/10'
                        : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'
                    )}
                    title={plan.is_active ? 'Desactivar Plan' : 'Reactivar Plan'}
                  >
                    <Ban size={15} />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
