import { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Tags, 
  Sparkles, 
  History, 
  AlertTriangle, 
  Layers, 
  WalletCards,
  XCircle
} from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useInventoryMovements } from '../../hooks/useInventoryMovements';
import { InventoryTable } from '../sales/InventoryTable';
import { ProductDrawer } from '../sales/ProductDrawer';
import { CategoryModal } from '../sales/CategoryModal';
import { ProductDetailDrawer } from './ProductDetailDrawer';
import { QuickMovementModal } from './QuickMovementModal';
import { InventoryMovementsTable } from './InventoryMovementsTable';
import type { Product } from '@shared/types/product';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { formatCurrency } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';

export function InventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'catalog' | 'movements' | 'critical'>('catalog');

  // Queries
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const movementsQuery = useInventoryMovements({ limit: 100 });

  const products = useMemo(() => productsQuery.query.data?.items || [], [productsQuery.query.data]);
  const categories = useMemo(() => categoriesQuery.query.data?.items || [], [categoriesQuery.query.data]);
  const movements = useMemo(() => movementsQuery.query.data?.items || [], [movementsQuery.query.data]);

  // Modal / Drawer States
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedProductForMovement, setSelectedProductForMovement] = useState<Product | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Derived Financial & Operational Stats (Only Real Data)
  const stats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let activeCount = 0;
    let costValuation = 0;
    let retailValuation = 0;

    products.forEach((p) => {
      if (p.is_active) activeCount++;
      const currentStock = Math.max(0, p.stock);
      const purchase = Number(p.purchase_price || 0);
      const sale = Number(p.sale_price || 0);

      costValuation += currentStock * purchase;
      retailValuation += currentStock * sale;

      if (p.stock <= 0) {
        outOfStockCount++;
      } else if (p.stock <= (p.minimum_stock || 5)) {
        lowStockCount++;
      }
    });

    return {
      total: products.length,
      active: activeCount,
      healthy: products.length - lowStockCount - outOfStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      criticalTotal: lowStockCount + outOfStockCount,
      costValuation,
      retailValuation,
    };
  }, [products]);

  // Handlers
  const handleOpenCreateProduct = () => {
    setSelectedProductForEdit(null);
    setIsProductDrawerOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setSelectedProductForEdit(product);
    setIsProductDrawerOpen(true);
  };

  const handleOpenDetail = (product: Product) => {
    setSelectedProductForDetail(product);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenQuickMovement = (product?: Product) => {
    setSelectedProductForMovement(product || null);
    setIsMovementModalOpen(true);
  };

  const handleToggleProductStatus = async (product: Product) => {
    try {
      if (product.is_active) {
        await productsQuery.deleteMutation.mutateAsync(product.id);
        toast({
          type: 'warning',
          title: 'Producto Desactivado',
          message: 'El producto ya no estará visible para facturación en POS.',
        });
      } else {
        await productsQuery.updateMutation.mutateAsync({
          id: product.id,
          data: { is_active: true },
        });
        toast({
          type: 'success',
          title: 'Producto Reactivado',
          message: 'El producto vuelve a estar habilitado para la venta.',
        });
      }
    } catch {
      toast({
        type: 'error',
        title: 'Error de Estado',
        message: 'No pudimos cambiar el estado del producto.',
      });
    }
  };

  const isInitialLoading = productsQuery.query.isLoading || categoriesQuery.query.isLoading;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-200">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Editorial Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <SectionEyebrow
              index="09"
              label="OPERACIONES // INVENTARIO"
              title="Inventario"
            />
            {stats.criticalTotal > 0 ? (
              <StatusBadge
                status="warning"
                size="sm"
                mode="pill"
                label={`${stats.criticalTotal} Alertas de Stock`}
              />
            ) : (
              <StatusBadge
                status="active"
                size="sm"
                mode="pill"
                label="Stock Saludable"
              />
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Control central de existencias, catálogo de productos, registro de movimientos y auditoría de mostrador.
          </p>
        </div>

        {/* Command Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-raised border border-border-medium rounded-lg hover:border-brand-primary/50 transition-colors cursor-pointer"
          >
            <Tags size={14} className="text-brand-primary" />
            <span>Categorías</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenQuickMovement()}
            className="px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold text-text-primary bg-surface-raised border border-border-medium rounded-lg hover:bg-surface-panel-hover transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span>Registrar Movimiento</span>
          </button>

          <ActionGlowButton onClick={handleOpenCreateProduct} className="text-xs font-bold py-2">
            <Plus size={15} />
            <span>Nuevo Producto</span>
          </ActionGlowButton>
        </div>
      </div>

      {/* Financial & Operational KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Productos */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">
              Catálogo de Ítems
            </span>
            <Package size={16} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-text-primary tracking-tight font-mono">
              {stats.total}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 font-mono">
              {stats.active} disponibles para venta
            </p>
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
              Stock Bajo
            </span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">
              {stats.lowStock}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">En o bajo el umbral mínimo</p>
          </div>
        </div>

        {/* Agotados */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 font-mono">
              Productos Agotados
            </span>
            <XCircle size={16} className="text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-400 tracking-tight font-mono">
              {stats.outOfStock}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">Sin existencias (0 uds)</p>
          </div>
        </div>

        {/* Valor de Inventario */}
        <div className="rounded-xl border border-brand-primary/30 bg-surface-panel/95 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-brand-primary">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary font-mono">
              Valoración en Existencias
            </span>
            <WalletCards size={16} className="text-brand-primary" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-text-primary tracking-tight font-mono">
              {formatCurrency(stats.costValuation)}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 font-mono">
              Comercial: {formatCurrency(stats.retailValuation)}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-surface-panel border border-border-subtle p-1 rounded-xl shadow-subtle w-full max-w-md flex relative">
        <div
          className="absolute inset-y-1 rounded-lg bg-surface-raised border border-border-medium shadow-elevated transition-all duration-300 ease-out z-0"
          style={{
            width: 'calc(33.333% - 3px)',
            left:
              activeTab === 'catalog'
                ? '4px'
                : activeTab === 'critical'
                ? 'calc(33.333% + 1px)'
                : 'calc(66.666% - 1px)',
          }}
        />

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'catalog'
              ? 'text-text-primary font-bold'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Layers size={14} />
          <span>Catálogo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('critical')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'critical'
              ? 'text-amber-400 font-bold'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <AlertTriangle size={14} />
          <span>Stock Crítico ({stats.criticalTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'movements'
              ? 'text-text-primary font-bold'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <History size={14} />
          <span>Kardex / Auditoría</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {/* TAB 1: Catálogo Completo */}
        {activeTab === 'catalog' && (
          <div className="animate-in fade-in duration-200">
            <InventoryTable
              products={products}
              categories={categories}
              onEdit={handleOpenEditProduct}
              onToggleStatus={handleToggleProductStatus}
              onViewDetail={handleOpenDetail}
              onOpenMovement={handleOpenQuickMovement}
              initialStockFilter="ALL"
            />
          </div>
        )}

        {/* TAB 2: Stock Crítico (Foco Operativo de Reabastecimiento) */}
        {activeTab === 'critical' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>
                  Mostrando únicamente productos que se encuentran en o por debajo de su umbral mínimo de seguridad.
                </span>
              </div>
              <span className="font-mono font-bold text-amber-200">
                {stats.criticalTotal} productos requieren atención
              </span>
            </div>

            <InventoryTable
              products={products.filter((p) => p.stock <= (p.minimum_stock || 5))}
              categories={categories}
              onEdit={handleOpenEditProduct}
              onToggleStatus={handleToggleProductStatus}
              onViewDetail={handleOpenDetail}
              onOpenMovement={handleOpenQuickMovement}
              initialStockFilter="LOW_STOCK"
            />
          </div>
        )}

        {/* TAB 3: Historial de Movimientos / Kardex */}
        {activeTab === 'movements' && (
          <div className="animate-in fade-in duration-200">
            <InventoryMovementsTable
              movements={movements}
              products={products}
              isLoading={movementsQuery.query.isLoading}
            />
          </div>
        )}
      </div>

      {/* Drawers and Modals */}
      <ProductDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        product={selectedProductForDetail}
        categories={categories}
        onEdit={handleOpenEditProduct}
        onToggleStatus={handleToggleProductStatus}
        onOpenMovement={handleOpenQuickMovement}
      />

      <QuickMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        products={products}
        initialProduct={selectedProductForMovement}
      />

      <ProductDrawer
        isOpen={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        product={selectedProductForEdit}
        categories={categories}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
      />
    </div>
  );
}
