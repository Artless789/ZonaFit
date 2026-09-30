import { useState, useMemo } from 'react';
import {
  Edit2,
  Ban,
  PackageOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Sparkles,
  Eye,
  Tag
} from 'lucide-react';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
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

interface InventoryTableProps {
  products: Product[];
  categories: Category[];
  onEdit: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
  onViewDetail?: (product: Product) => void;
  onOpenMovement?: (product: Product) => void;
  initialStockFilter?: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'HEALTHY';
}

export function InventoryTable({
  products,
  categories,
  onEdit,
  onToggleStatus,
  onViewDetail,
  onOpenMovement,
  initialStockFilter = 'ALL',
}: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK'>(
    initialStockFilter
  );

  // Fast category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Derived counts
  const stats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let activeCount = 0;

    products.forEach((p) => {
      if (p.is_active) activeCount++;
      if (p.stock <= 0) outOfStockCount++;
      else if (p.stock <= (p.minimum_stock || 5)) lowStockCount++;
    });

    return {
      total: products.length,
      active: activeCount,
      healthy: products.length - lowStockCount - outOfStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
    };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search);

      const matchesCategory =
        selectedCategory === 'all' || product.category_id === selectedCategory;

      let matchesStockStatus = true;
      if (stockStatusFilter === 'OUT_OF_STOCK') {
        matchesStockStatus = product.stock <= 0;
      } else if (stockStatusFilter === 'LOW_STOCK') {
        matchesStockStatus = product.stock > 0 && product.stock <= (product.minimum_stock || 5);
      } else if (stockStatusFilter === 'HEALTHY') {
        matchesStockStatus = product.stock > (product.minimum_stock || 5);
      }

      return matchesSearch && matchesCategory && matchesStockStatus;
    });
  }, [products, searchTerm, selectedCategory, stockStatusFilter]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border-subtle bg-surface-panel/80 shadow-subtle backdrop-blur-md">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 text-brand-primary border border-brand-primary/20">
          <PackageOpen size={32} />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">
          Inventario Vacío
        </h3>
        <p className="text-xs text-text-secondary max-w-md">
          No tienes productos dados de alta en este gimnasio. Crea tus primeras categorías
          y añade productos para comenzar a operar el punto de venta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Quick Metrics & Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <button
          type="button"
          onClick={() => setStockStatusFilter('ALL')}
          className={cn(
            'p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
            stockStatusFilter === 'ALL'
              ? 'border-brand-primary/40 bg-brand-primary/10 shadow-xs'
              : 'border-border-subtle bg-surface-panel/80 hover:bg-surface-raised'
          )}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-text-muted">Total Catálogo</span>
            <span className="text-lg font-black text-text-primary">{stats.total}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-base border border-border-subtle text-text-secondary">
            {stats.active} activos
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStockStatusFilter('HEALTHY')}
          className={cn(
            'p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
            stockStatusFilter === 'HEALTHY'
              ? 'border-emerald-500/40 bg-emerald-500/10 shadow-xs'
              : 'border-border-subtle bg-surface-panel/80 hover:bg-surface-raised'
          )}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-emerald-400">Stock Saludable</span>
            <span className="text-lg font-black text-emerald-400">{stats.healthy}</span>
          </div>
          <CheckCircle2 size={16} className="text-emerald-400 opacity-80" />
        </button>

        <button
          type="button"
          onClick={() => setStockStatusFilter('LOW_STOCK')}
          className={cn(
            'p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
            stockStatusFilter === 'LOW_STOCK'
              ? 'border-amber-500/40 bg-amber-500/10 shadow-xs'
              : 'border-border-subtle bg-surface-panel/80 hover:bg-surface-raised'
          )}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-amber-400">Stock Bajo (Mora)</span>
            <span className="text-lg font-black text-amber-400">{stats.lowStock}</span>
          </div>
          <AlertTriangle size={16} className="text-amber-400 opacity-80" />
        </button>

        <button
          type="button"
          onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
          className={cn(
            'p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
            stockStatusFilter === 'OUT_OF_STOCK'
              ? 'border-rose-500/40 bg-rose-500/10 shadow-xs'
              : 'border-border-subtle bg-surface-panel/80 hover:bg-surface-raised'
          )}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-rose-400">Agotados (0)</span>
            <span className="text-lg font-black text-rose-400">{stats.outOfStock}</span>
          </div>
          <XCircle size={16} className="text-rose-400 opacity-80" />
        </button>
      </div>

      {/* Search & Category Filter Header */}
      <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-panel/85 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            size={15}
          />
          <input
            type="text"
            placeholder="Buscar producto por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-border-medium bg-surface-base text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-all font-sans"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
              selectedCategory === 'all'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle'
            )}
          >
            Todas ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                selectedCategory === c.id
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <TableContainer className="rounded-2xl border-border-subtle bg-surface-panel/90 backdrop-blur-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase">Producto & SKU</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase">Categoría</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase text-right">Costo</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase text-right">Precio Venta</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase text-center">Stock Físico</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase text-center">Estado</TableHead>
              <TableHead className="px-5 py-3.5 font-mono text-xs uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5 text-text-muted">
                    <PackageOpen size={24} className="opacity-40" />
                    <span className="text-xs font-medium">
                      No hay productos que coincidan con la búsqueda o filtro seleccionado.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock =
                  product.stock > 0 && product.stock <= (product.minimum_stock || 5);
                const categoryName = categoryMap.get(product.category_id) || 'Sin Categoría';

                return (
                  <TableRow
                    key={product.id}
                    className={cn(
                      'hover:bg-surface-panel-hover transition-colors group',
                      !product.is_active && 'opacity-60'
                    )}
                  >
                    {/* Name & SKU */}
                    <TableCell className="px-5 py-3.5">
                      <div className="font-bold text-text-primary text-xs">
                        {product.name}
                      </div>
                      <div className="font-mono text-[11px] text-text-muted tracking-wider uppercase">
                        {product.sku || 'SIN-SKU'}
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-base border border-border-subtle text-text-secondary inline-flex items-center gap-1">
                        <Tag size={10} className="text-brand-primary" />
                        <span>{categoryName}</span>
                      </span>
                    </TableCell>

                    {/* Purchase Price */}
                    <TableCell className="px-5 py-3.5 font-mono text-xs text-text-secondary text-right">
                      {formatCurrency(product.purchase_price || 0)}
                    </TableCell>

                    {/* Sale Price */}
                    <TableCell className="px-5 py-3.5 font-mono font-bold text-xs text-text-primary text-right">
                      {formatCurrency(product.sale_price)}
                    </TableCell>

                    {/* Stock */}
                    <TableCell className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        <span
                          className={cn(
                            'font-mono font-black text-sm',
                            isOutOfStock
                              ? 'text-rose-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          )}
                        >
                          {product.stock}
                        </span>
                        {isOutOfStock ? (
                          <StatusBadge status="danger" size="sm" mode="pill" label="Agotado" />
                        ) : isLowStock ? (
                          <StatusBadge status="warning" size="sm" mode="pill" label="Stock Bajo" />
                        ) : (
                          <span className="text-[10px] font-mono text-text-muted">
                            (Mín: {product.minimum_stock || 5})
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-5 py-3.5 text-center">
                      {product.is_active ? (
                        <StatusBadge status="active" size="sm" mode="pill" label="Activo" />
                      ) : (
                        <StatusBadge status="neutral" size="sm" mode="pill" label="Inactivo" />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick Movement */}
                        {onOpenMovement && (
                          <button
                            type="button"
                            onClick={() => onOpenMovement(product)}
                            className="p-1.5 text-text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors cursor-pointer"
                            title="Registrar entrada/salida rápida"
                          >
                            <Sparkles size={14} />
                          </button>
                        )}

                        {/* View Kardex/Detail */}
                        {onViewDetail && (
                          <button
                            type="button"
                            onClick={() => onViewDetail(product)}
                            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md transition-colors cursor-pointer"
                            title="Ver Ficha y Kardex"
                          >
                            <Eye size={14} />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          className="p-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors cursor-pointer"
                          title="Editar Ficha de Producto"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Toggle Status */}
                        <button
                          type="button"
                          onClick={() => onToggleStatus(product)}
                          className={cn(
                            'p-1.5 rounded-md transition-colors cursor-pointer',
                            product.is_active
                              ? 'text-text-muted hover:text-rose-400 hover:bg-rose-500/10'
                              : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'
                          )}
                          title={product.is_active ? 'Desactivar Producto' : 'Reactivar Producto'}
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
