import { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Filter, 
  Receipt,
  FileText
} from 'lucide-react';
import type { InventoryMovement } from '@shared/types/inventory_movement';
import type { Product } from '@shared/types/product';
import { formatDate } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';

interface InventoryMovementsTableProps {
  movements: InventoryMovement[];
  products: Product[];
  isLoading: boolean;
}

export function InventoryMovementsTable({
  movements,
  products,
  isLoading,
}: InventoryMovementsTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Fast product lookup map
  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const filteredMovements = useMemo(() => {
    if (typeFilter === 'ALL') return movements;
    return movements.filter((m) => m.movement_type === typeFilter);
  }, [movements, typeFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-text-muted space-y-2">
        <RefreshCw className="animate-spin text-brand-primary" size={24} />
        <span className="text-xs font-mono tracking-wider uppercase">Cargando auditoría de movimientos...</span>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-panel/80 p-12 flex flex-col items-center justify-center text-center space-y-2">
        <Receipt size={36} className="text-text-muted opacity-30" />
        <h4 className="text-sm font-bold text-text-primary">Sin Movimientos Registrados</h4>
        <p className="text-xs text-text-secondary max-w-sm">
          Aún no se han efectuado entradas, salidas o ajustes de inventario en este gimnasio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Filters Bar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-surface-panel/80 rounded-xl border border-border-subtle">
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <Filter size={14} className="text-brand-primary" />
          <span>Filtrar por Tipo:</span>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { value: 'ALL', label: `Todos (${movements.length})` },
            { value: 'IN', label: 'Entradas (+)' },
            { value: 'OUT', label: 'Salidas (-)' },
            { value: 'ADJUSTMENT', label: 'Ajustes (=)' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer',
                typeFilter === tab.value
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'bg-surface-base text-text-muted hover:text-text-primary border border-border-subtle'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl border border-border-subtle bg-surface-panel/90 p-0 overflow-hidden shadow-subtle backdrop-blur-md">
        <div className="overflow-x-auto min-h-64">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-text-muted uppercase bg-surface-raised/80 border-b border-border-subtle font-semibold tracking-wider font-mono">
              <tr>
                <th className="px-5 py-3.5">Fecha & Hora</th>
                <th className="px-5 py-3.5">Producto & SKU</th>
                <th className="px-5 py-3.5 text-center">Tipo</th>
                <th className="px-5 py-3.5 text-right">Variación</th>
                <th className="px-5 py-3.5 text-center">Evolución Stock</th>
                <th className="px-5 py-3.5">Motivo / Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filteredMovements.map((mov) => {
                const prod = productMap.get(mov.product_id);
                const productName = prod?.name || `Producto #${mov.product_id}`;
                const productSku = prod?.sku || 'SIN-SKU';

                return (
                  <tr key={mov.id} className="hover:bg-surface-panel-hover transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-3 text-text-secondary font-mono">
                      {formatDate(mov.created_at)}
                    </td>

                    {/* Product */}
                    <td className="px-5 py-3">
                      <div className="font-bold text-text-primary text-xs">{productName}</div>
                      <div className="font-mono text-[11px] text-text-muted uppercase">{productSku}</div>
                    </td>

                    {/* Movement Type */}
                    <td className="px-5 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full border',
                          mov.movement_type === 'IN'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : mov.movement_type === 'OUT'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        )}
                      >
                        {mov.movement_type === 'IN' ? (
                          <ArrowUpRight size={11} />
                        ) : mov.movement_type === 'OUT' ? (
                          <ArrowDownRight size={11} />
                        ) : (
                          <RefreshCw size={10} />
                        )}
                        <span>{mov.movement_type === 'IN' ? 'ENTRADA' : mov.movement_type === 'OUT' ? 'SALIDA' : 'AJUSTE'}</span>
                      </span>
                    </td>

                    {/* Quantity delta */}
                    <td className="px-5 py-3 text-right font-mono font-black text-sm">
                      <span
                        className={
                          mov.movement_type === 'IN'
                            ? 'text-emerald-400'
                            : mov.movement_type === 'OUT'
                            ? 'text-rose-400'
                            : 'text-indigo-400'
                        }
                      >
                        {mov.movement_type === 'IN'
                          ? `+${mov.quantity}`
                          : mov.movement_type === 'OUT'
                          ? `-${mov.quantity}`
                          : `=${mov.quantity}`}
                      </span>
                    </td>

                    {/* Stock Evolution */}
                    <td className="px-5 py-3 text-center font-mono text-xs">
                      <span className="text-text-muted">{mov.stock_before}</span>
                      <span className="text-text-muted mx-1.5">→</span>
                      <span className="font-bold text-text-primary">{mov.stock_after} uds</span>
                    </td>

                    {/* Reason */}
                    <td className="px-5 py-3 text-text-secondary max-w-xs truncate" title={mov.reason || ''}>
                      {mov.reason ? (
                        <span className="flex items-center gap-1.5 font-sans">
                          <FileText size={12} className="text-brand-primary shrink-0" />
                          <span className="truncate">{mov.reason}</span>
                        </span>
                      ) : (
                        <span className="text-text-muted italic font-mono text-[11px]">Sin motivo registrado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
