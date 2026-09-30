import { useState, useMemo } from 'react';
import { Modal } from '@shared/ui/Modal';
import { NumericInput } from '@shared/ui/NumericInput';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { useInventoryMovements } from '../../hooks/useInventoryMovements';
import type { Product } from '@shared/types/product';
import type { InventoryMovementType } from '@shared/types/inventory_movement';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  AlertTriangle, 
  Package, 
  Sparkles
} from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface QuickMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProduct?: Product | null;
}

export function QuickMovementModal({
  isOpen,
  onClose,
  products,
  initialProduct,
}: QuickMovementModalProps) {
  const { toast } = useToast();
  const { createMutation } = useInventoryMovements();

  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    initialProduct?.id || null
  );
  const [movementType, setMovementType] = useState<InventoryMovementType>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');

  // Selected product object
  const activeProduct = useMemo(() => {
    if (selectedProductId) {
      return products.find((p) => p.id === selectedProductId) || initialProduct || null;
    }
    return initialProduct || products[0] || null;
  }, [products, selectedProductId, initialProduct]);

  // Derived stock calculation
  const currentStock = activeProduct ? activeProduct.stock : 0;

  const stockAfter = useMemo(() => {
    if (!activeProduct) return 0;
    if (movementType === 'IN') return currentStock + quantity;
    if (movementType === 'OUT') return currentStock - quantity;
    if (movementType === 'ADJUSTMENT') return quantity;
    return currentStock;
  }, [activeProduct, currentStock, movementType, quantity]);

  const hasInsufficientStock = movementType === 'OUT' && quantity > currentStock;

  const handleConfirm = async () => {
    if (!activeProduct) {
      toast({ type: 'error', title: 'Producto Requerido', message: 'Selecciona un producto del catálogo.' });
      return;
    }
    if (quantity <= 0 && movementType !== 'ADJUSTMENT') {
      toast({ type: 'error', title: 'Cantidad Inválida', message: 'La cantidad debe ser mayor a 0.' });
      return;
    }
    if (movementType === 'ADJUSTMENT' && quantity < 0) {
      toast({ type: 'error', title: 'Cantidad Inválida', message: 'El nuevo stock ajustado no puede ser negativo.' });
      return;
    }
    if (hasInsufficientStock) {
      toast({
        type: 'error',
        title: 'Stock Insuficiente',
        message: `No puedes retirar ${quantity} unidades porque solo hay ${currentStock} disponibles.`,
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        product_id: activeProduct.id,
        movement_type: movementType,
        quantity,
        reason: reason.trim() || undefined,
      });

      toast({
        type: 'success',
        title: 'Movimiento Registrado',
        message: `Se actualizó el stock de ${activeProduct.name} a ${stockAfter} unidades.`,
      });

      setQuantity(1);
      setReason('');
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo registrar el movimiento de inventario.';
      toast({ type: 'error', title: 'Error al Registrar', message });
    }
  };

  const isSaving = createMutation.isPending;

  // Preset reasons based on movement type
  const reasonPresets = useMemo(() => {
    if (movementType === 'IN') {
      return ['Compra a proveedor', 'Reabastecimiento de mostrador', 'Devolución de cliente'];
    }
    if (movementType === 'OUT') {
      return ['Merma / Producto dañado', 'Vencimiento', 'Consumo interno / Gimnasio', 'Pérdida'];
    }
    return ['Ajuste tras conteo físico', 'Corrección de existencias', 'Apertura de lote'];
  }, [movementType]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSaving && onClose()}
      title="Registrar Movimiento de Inventario"
    >
      <div className="space-y-4 font-sans text-sm">
        {/* Product Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono mb-1">
            Producto Seleccionado
          </label>
          <select
            value={activeProduct?.id || ''}
            onChange={(e) => setSelectedProductId(Number(e.target.value))}
            disabled={isSaving}
            className="w-full h-10 px-3 rounded-lg border border-border-medium bg-surface-base text-xs font-medium text-text-primary focus:outline-none focus:border-brand-primary font-sans"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (SKU: {p.sku || 'N/A'}) — Stock: {p.stock}
              </option>
            ))}
          </select>
        </div>

        {/* Movement Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono mb-1.5">
            Tipo de Movimiento
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMovementType('IN')}
              disabled={isSaving}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer',
                movementType === 'IN'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-xs'
                  : 'bg-surface-base border-border-subtle text-text-muted hover:text-text-primary'
              )}
            >
              <ArrowUpRight size={14} />
              <span>ENTRADA (+)</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType('OUT')}
              disabled={isSaving}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer',
                movementType === 'OUT'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-xs'
                  : 'bg-surface-base border-border-subtle text-text-muted hover:text-text-primary'
              )}
            >
              <ArrowDownRight size={14} />
              <span>SALIDA (-)</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType('ADJUSTMENT')}
              disabled={isSaving}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer',
                movementType === 'ADJUSTMENT'
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400 shadow-xs'
                  : 'bg-surface-base border-border-subtle text-text-muted hover:text-text-primary'
              )}
            >
              <RefreshCw size={13} />
              <span>AJUSTE (=)</span>
            </button>
          </div>
        </div>

        {/* Quantity & Stock Evolution Card */}
        <div className="bg-surface-base border border-border-subtle rounded-xl p-3.5 space-y-3 font-mono">
          <div className="flex justify-between items-center text-xs pb-2 border-b border-border-subtle">
            <span className="text-text-muted font-sans flex items-center gap-1.5">
              <Package size={13} className="text-brand-primary" />
              <span>Stock Actual:</span>
            </span>
            <span className="font-bold text-text-primary text-sm">{currentStock} unidades</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono mb-1">
              {movementType === 'ADJUSTMENT' ? 'Nuevo Stock Total Fijado' : 'Cantidad a Mover'}
            </label>
            <NumericInput
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={0}
              placeholder="0"
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-between items-center text-xs pt-1 border-t border-border-subtle">
            <span className="text-text-muted font-sans">Stock Resultante Tras Movimiento:</span>
            <span
              className={cn(
                'font-black text-sm',
                hasInsufficientStock
                  ? 'text-rose-400'
                  : stockAfter > currentStock
                  ? 'text-emerald-400'
                  : stockAfter === currentStock
                  ? 'text-text-primary'
                  : 'text-amber-400'
              )}
            >
              {stockAfter} unidades
            </span>
          </div>

          {/* Insufficient Stock Warning */}
          {hasInsufficientStock && (
            <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-sans flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>
                La cantidad a retirar supera el stock actual disponible ({currentStock} uds).
              </span>
            </div>
          )}
        </div>

        {/* Reason / Motivo */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
            Motivo u Observación (Opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            placeholder="Ej. Factura #402, Merma por daño, Conteo físico mensual..."
            className="w-full h-9 px-3 rounded-lg border border-border-medium bg-surface-base text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary"
          />

          {/* Reason Presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {reasonPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-raised hover:bg-surface-panel-hover border border-border-subtle text-text-secondary transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <ActionGlowButton
            onClick={handleConfirm}
            disabled={isSaving || !activeProduct || hasInsufficientStock}
            isLoading={isSaving}
            className="text-xs font-bold py-2"
          >
            <Sparkles size={14} />
            <span>Confirmar Movimiento</span>
          </ActionGlowButton>
        </div>
      </div>
    </Modal>
  );
}
