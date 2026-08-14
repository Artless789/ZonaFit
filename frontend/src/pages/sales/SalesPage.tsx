import { useState } from 'react';
import { ShoppingCart, Package, Plus, Tags } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useClients } from '../../hooks/useClients';
import { InventoryTable } from './InventoryTable';
import { ProductDrawer } from './ProductDrawer';
import { CategoryModal } from './CategoryModal';
import { POSView } from './POSView';
import type { Product } from '../../types/product';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { Skeleton } from '../../components/shared/Skeleton';
import { useToast } from '../../components/shared/Toast';
import { cn } from '../../utils/cn';

export function SalesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory'>('pos');

  // Queries
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const clientsQuery = useClients();

  const products = productsQuery.query.data?.items || [];
  const categories = categoriesQuery.query.data?.items || [];
  const clients = clientsQuery.query.data?.items || [];

  // Drawer/Modal States
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Handlers
  const handleOpenCreateProduct = () => {
    setSelectedProduct(null);
    setIsProductDrawerOpen(true);
  };
  const handleOpenEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsProductDrawerOpen(true);
  };
  
  const handleToggleProductStatus = async (product: Product) => {
    try {
      if (product.is_active) {
        await productsQuery.deleteMutation.mutateAsync(product.id);
        toast({ type: 'warning', title: 'Producto Desactivado', message: 'El producto ya no aparecerá en el POS.' });
      } else {
        await productsQuery.updateMutation.mutateAsync({ id: product.id, data: { is_active: true } });
        toast({ type: 'success', title: 'Producto Reactivado', message: 'El producto vuelve a estar disponible.' });
      }
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado del producto.' });
    }
  };

  const isLoading = productsQuery.query.isLoading || categoriesQuery.query.isLoading || clientsQuery.query.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Ventas e Inventario</h1>
          <p className="text-text-secondary text-sm mt-1">
            Gestiona tu catálogo de productos y realiza ventas rápidas a tus clientes.
          </p>
        </div>
        
        {/* Dynamic Action Buttons based on Active Tab */}
        {activeTab === 'inventory' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-surface border border-border-medium rounded-lg hover:border-brand-primary/50 transition-colors"
            >
              <Tags size={16} />
              Categorías
            </button>
            <ActionGlowButton onClick={handleOpenCreateProduct}>
              <Plus size={18} />
              <span>Nuevo Producto</span>
            </ActionGlowButton>
          </div>
        )}
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-bg-surface border border-border-light p-1 rounded-xl shadow-glass w-full max-w-sm flex relative">
        <div 
          className="absolute inset-y-1 rounded-lg bg-bg-elevated border border-border-medium shadow-sm transition-all duration-300 ease-out z-0"
          style={{
            width: 'calc(50% - 4px)',
            left: activeTab === 'pos' ? '4px' : 'calc(50%)',
          }}
        />
        
        <button
          onClick={() => setActiveTab('pos')}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
            activeTab === 'pos' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          <ShoppingCart size={16} />
          <span>Punto de Venta (POS)</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
            activeTab === 'inventory' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          <Package size={16} />
          <span>Inventario</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'pos' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <POSView 
              products={products}
              categories={categories}
              clients={clients}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <InventoryTable 
              products={products}
              categories={categories}
              onEdit={handleOpenEditProduct}
              onToggleStatus={handleToggleProductStatus}
            />
          </div>
        )}
      </div>

      {/* Drawers and Modals */}
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
