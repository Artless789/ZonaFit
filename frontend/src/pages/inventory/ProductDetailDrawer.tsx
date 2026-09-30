import { Drawer } from '@shared/ui/Drawer';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { 
  Package, 
  Tag, 
  DollarSign, 
  History, 
  Clock, 
  Edit2, 
  Ban, 
  Sparkles 
} from 'lucide-react';
import { useInventoryMovements } from '../../hooks/useInventoryMovements';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';

interface ProductDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  onEdit: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
  onOpenMovement: (product: Product) => void;
}

export function ProductDetailDrawer({
  isOpen,
  onClose,
  product,
  categories,
  onEdit,
  onToggleStatus,
  onOpenMovement,
}: ProductDetailDrawerProps) {
  // Query movements specifically for this product
  const movementsQuery = useInventoryMovements({
    product_id: product?.id,
    limit: 10,
  });

  if (!product) return null;

  const category = categories.find((c) => c.id === product.category_id);
  const categoryName = category?.name || 'Sin Categoría';

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= (product.minimum_stock || 5);

  const purchasePrice = Number(product.purchase_price || 0);
  const salePrice = Number(product.sale_price || 0);
  const margin = salePrice > 0 ? Math.round(((salePrice - purchasePrice) / salePrice) * 100) : 0;
  const inventoryValuation = product.stock * purchasePrice;

  const movements = movementsQuery.query.data?.items || [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Ficha Técnica & Kardex de Producto"
    >
      <div className="space-y-5 font-sans text-sm">
        {/* Header Profile Card */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0 shadow-glow">
                <Package size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary tracking-tight">{product.name}</h3>
                <div className="flex items-center gap-2 text-xs font-mono text-text-muted mt-0.5">
                  <span>SKU: {product.sku || 'SIN-SKU'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-text-secondary">
                    <Tag size={12} className="text-brand-primary" />
                    <span>{categoryName}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              {isOutOfStock ? (
                <StatusBadge status="danger" label="AGOTADO" size="sm" mode="pill" />
              ) : isLowStock ? (
                <StatusBadge status="warning" label="STOCK BAJO" size="sm" mode="pill" />
              ) : product.is_active ? (
                <StatusBadge status="active" label="DISPONIBLE" size="sm" mode="pill" />
              ) : (
                <StatusBadge status="neutral" label="INACTIVO" size="sm" mode="pill" />
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-xs text-text-secondary bg-surface-base/80 p-2.5 rounded-lg border border-border-subtle leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Quick Action Bar inside Drawer */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle">
            <ActionGlowButton
              onClick={() => onOpenMovement(product)}
              className="text-xs font-bold py-2"
            >
              <Sparkles size={14} />
              <span>Registrar Movimiento</span>
            </ActionGlowButton>

            <button
              type="button"
              onClick={() => onEdit(product)}
              className="py-2 px-3 text-xs font-semibold bg-surface-raised border border-border-medium rounded-lg hover:bg-surface-panel-hover transition-colors text-text-primary flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit2 size={13} />
              <span>Editar Ficha</span>
            </button>
          </div>
        </div>

        {/* Stock & Valuation Metrics */}
        <div className="rounded-xl border border-border-subtle bg-surface-base/80 p-4 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Estado de Existencias
            </span>
            <span className="text-[11px] text-text-muted">Umbral Mín: {product.minimum_stock || 5} uds</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-surface-panel/90 rounded-lg border border-border-subtle">
              <span className="text-[10px] text-text-muted uppercase block font-sans">Stock Actual</span>
              <span
                className={cn(
                  'text-2xl font-black block mt-0.5',
                  isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                )}
              >
                {product.stock}
              </span>
              <span className="text-[10px] text-text-muted font-sans">Unidades físicas en mostrador</span>
            </div>

            <div className="p-3 bg-surface-panel/90 rounded-lg border border-border-subtle">
              <span className="text-[10px] text-text-muted uppercase block font-sans">Capital Inmovilizado</span>
              <span className="text-2xl font-black text-text-primary block mt-0.5">
                {formatCurrency(inventoryValuation)}
              </span>
              <span className="text-[10px] text-text-muted font-sans">Valoración a precio costo</span>
            </div>
          </div>
        </div>

        {/* Financial & Pricing Breakdown */}
        <div className="rounded-xl border border-border-subtle bg-surface-base/80 p-4 space-y-2.5 font-mono">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <DollarSign size={14} className="text-brand-primary" />
              <span>Precios & Margen Comercial</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              +{margin}% margen bruto
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="text-[10px] text-text-muted uppercase block font-sans">Precio de Compra (Costo)</span>
              <span className="font-bold text-text-secondary text-sm">{formatCurrency(purchasePrice)}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block font-sans">Precio de Venta Público</span>
              <span className="font-bold text-emerald-400 text-sm">{formatCurrency(salePrice)}</span>
            </div>
          </div>
        </div>

        {/* Movements Audit History (Kardex) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
              <History size={14} className="text-brand-primary" />
              <span>Historial de Movimientos ({movements.length})</span>
            </h4>
            <span className="text-[10px] text-text-muted font-mono">Últimas transacciones</span>
          </div>

          {movementsQuery.query.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : movements.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface-base/50 flex flex-col items-center justify-center py-8 text-center text-text-muted border-dashed space-y-1">
              <Clock size={24} className="opacity-20" />
              <p className="text-xs">No hay movimientos registrados para este producto todavía.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((mov) => (
                <div
                  key={mov.id}
                  className="rounded-xl border border-border-subtle bg-surface-panel/90 p-3 flex justify-between items-center hover:bg-surface-panel-hover transition-colors font-mono"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-black',
                          mov.movement_type === 'IN'
                            ? 'text-emerald-400'
                            : mov.movement_type === 'OUT'
                            ? 'text-rose-400'
                            : 'text-indigo-400'
                        )}
                      >
                        {mov.movement_type === 'IN' ? `+${mov.quantity}` : mov.movement_type === 'OUT' ? `-${mov.quantity}` : `=${mov.quantity}`}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-text-secondary font-bold">
                        {mov.movement_type}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        ({mov.stock_before} → {mov.stock_after} uds)
                      </span>
                    </div>
                    {mov.reason && (
                      <p className="text-[11px] text-text-secondary font-sans truncate max-w-56" title={mov.reason}>
                        {mov.reason}
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] text-text-muted shrink-0">
                    {formatDate(mov.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Status Action */}
        <div className="pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => onToggleStatus(product)}
            className={cn(
              'w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
              product.is_active
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
            )}
          >
            <Ban size={13} />
            <span>{product.is_active ? 'Desactivar Producto en Terminal' : 'Reactivar Producto'}</span>
          </button>
        </div>
      </div>
    </Drawer>
  );
}
