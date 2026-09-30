import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, Package, Plus, Tags, ReceiptText, Sparkles } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useClients } from '../../hooks/useClients';
import { useSales } from '../../hooks/useSales';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { InventoryTable } from './InventoryTable';
import { ProductDrawer } from './ProductDrawer';
import { CategoryModal } from './CategoryModal';
import { ProductDetailDrawer } from '../inventory/ProductDetailDrawer';
import { QuickMovementModal } from '../inventory/QuickMovementModal';
import { POSView } from './POSView';
import { SalesHistoryTable } from './SalesHistoryTable';
import type { Product } from '@shared/types/product';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

export function SalesPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'inventory' || tabParam === 'history' ? tabParam : 'pos';
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'history'>(initialTab);

  useEffect(() => {
    const current = searchParams.get('tab');
    if (current === 'inventory' || current === 'history' || current === 'pos') {
      setActiveTab(current);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'pos' | 'inventory' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Queries
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const clientsQuery = useClients(1, 200);
  const salesQuery = useSales();
  const { activeRegister } = useCashRegisters();

  const products = productsQuery.query.data?.items || [];
  const categories = categoriesQuery.query.data?.items || [];
  const clients = clientsQuery.query.data?.items || [];
  const sales = salesQuery.query.data?.items || [];

  // Drawer / Modal States
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedProductForMovement, setSelectedProductForMovement] = useState<Product | null>(null);

  // Handlers
  const handleOpenCreateProduct = () => {
    setSelectedProduct(null);
    setIsProductDrawerOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setSelectedProduct(product);
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
          message: 'El producto ya no aparecerá disponible en el terminal de venta.',
        });
      } else {
        await productsQuery.updateMutation.mutateAsync({
          id: product.id,
          data: { is_active: true },
        });
        toast({
          type: 'success',
          title: 'Producto Reactivado',
          message: 'El producto vuelve a estar habilitado para facturar.',
        });
      }
    } catch {
      toast({
        type: 'error',
        title: 'Error de Estado',
        message: 'No pudimos actualizar el estado del producto.',
      });
    }
  };

  const isInitialLoading =
    productsQuery.query.isLoading ||
    categoriesQuery.query.isLoading ||
    clientsQuery.query.isLoading;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[620px] w-full rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 relative">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <SectionEyebrow
              label="TERMINAL DE VENTAS // POS"
              title="Estación de Venta & Mostrador"
            />
            {/* Realtime Cash Register Status Indicator */}
            {activeRegister.data ? (
              <StatusBadge
                status="open"
                size="sm"
                label={`Caja Abierta #${activeRegister.data.id}`}
              />
            ) : (
              <StatusBadge
                status="closed"
                size="sm"
                label="Caja Cerrada"
              />
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Facturación rápida en mostrador, control de existencias e historial de tickets emitidos.
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        {activeTab === 'inventory' && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3.5 py-2 flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-raised border border-border-medium rounded-[var(--radius-md)] hover:border-brand-primary/50 transition-colors cursor-pointer"
            >
              <Tags size={15} />
              <span>Categorías</span>
            </button>
            <button
              onClick={() => handleOpenQuickMovement()}
              className="px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold text-text-primary bg-surface-raised border border-border-medium rounded-[var(--radius-md)] hover:bg-surface-panel-hover transition-colors cursor-pointer"
            >
              <Sparkles size={14} className="text-emerald-400" />
              <span>Ajustar stock</span>
            </button>
            <ActionGlowButton onClick={handleOpenCreateProduct} className="text-xs">
              <Plus size={16} />
              <span>Nuevo Producto</span>
            </ActionGlowButton>
          </div>
        )}
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-surface-panel border border-border-subtle p-1 rounded-[var(--radius-xl)] shadow-subtle w-full max-w-md flex relative">
        <div
          className="absolute inset-y-1 rounded-[var(--radius-lg)] bg-surface-raised border border-border-medium shadow-elevated transition-all duration-300 ease-out z-0"
          style={{
            width: 'calc(33.333% - 3px)',
            left:
              activeTab === 'pos'
                ? '4px'
                : activeTab === 'inventory'
                ? 'calc(33.333% + 1px)'
                : 'calc(66.666% - 1px)',
          }}
        />

        <button
          onClick={() => handleTabChange('pos')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'pos'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <ShoppingCart size={15} />
          <span>POS</span>
        </button>

        <button
          onClick={() => handleTabChange('inventory')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'inventory'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Package size={15} />
          <span>Inventario</span>
        </button>

        <button
          onClick={() => handleTabChange('history')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'history'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <ReceiptText size={15} />
          <span>Historial</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'pos' && (
          <div className="animate-in fade-in duration-200">
            <POSView
              products={products}
              categories={categories}
              clients={clients}
            />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-in fade-in duration-200">
            <InventoryTable
              products={products}
              categories={categories}
              onEdit={handleOpenEditProduct}
              onToggleStatus={handleToggleProductStatus}
              onViewDetail={handleOpenDetail}
              onOpenMovement={handleOpenQuickMovement}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-200">
            <SalesHistoryTable
              sales={sales}
              clients={clients}
              isLoading={salesQuery.query.isLoading}
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
        product={selectedProduct}
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
