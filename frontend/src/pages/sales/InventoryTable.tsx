import { Edit2, Ban, PackageOpen } from 'lucide-react';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';
import { formatCurrency } from '@shared/utils/formatters';

interface InventoryTableProps {
  products: Product[];
  categories: Category[];
  onEdit: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
}

export function InventoryTable({ products, categories, onEdit, onToggleStatus }: InventoryTableProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface-panel/80 rounded-[var(--radius-xl)] border border-border-subtle border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <PackageOpen className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Inventario Vacío</h3>
        <p className="text-text-secondary max-w-sm">
          No tienes productos registrados. Crea categorías y añade productos para empezar a vender.
        </p>
      </div>
    );
  }

  const formatPrice = formatCurrency;

  const getCategoryName = (id: number) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Sin Categoría';
  };

  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/90 shadow-subtle backdrop-blur-md">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-surface-raised/70 text-text-muted border-b border-border-subtle tracking-wider font-semibold">
          <tr>
            <th scope="col" className="px-6 py-3.5">Producto / SKU</th>
            <th scope="col" className="px-6 py-3.5">Categoría</th>
            <th scope="col" className="px-6 py-3.5">Precio Venta</th>
            <th scope="col" className="px-6 py-3.5">Stock</th>
            <th scope="col" className="px-6 py-3.5">Estado</th>
            <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {products.map((product) => {
            const isLowStock = product.stock <= product.minimum_stock;
            
            return (
              <tr 
                key={product.id} 
                className={cn("hover:bg-surface-panel-hover transition-colors group", !product.is_active && "opacity-50")}
              >
                <td className="px-6 py-3.5">
                  <div className="font-semibold text-text-primary">{product.name}</div>
                  <div className="text-xs text-text-muted font-mono">{product.sku}</div>
                </td>
                <td className="px-6 py-3.5">
                  <Badge variant="default" className="bg-surface-base text-text-muted border-border-subtle">{getCategoryName(product.category_id)}</Badge>
                </td>
                <td className="px-6 py-3.5 font-medium text-text-primary">
                  {formatPrice(product.sale_price)}
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", isLowStock ? "text-rose-400" : "text-text-primary")}>
                      {product.stock}
                    </span>
                    {isLowStock && <Badge variant="danger" className="text-[10px] px-1.5 py-0">Bajo</Badge>}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  {product.is_active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="danger">Inactivo</Badge>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(product)}
                      className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                      title="Editar Producto"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => onToggleStatus(product)}
                      className={cn(
                        "p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                        product.is_active 
                          ? "text-text-muted hover:text-rose-400 hover:bg-rose-500/10" 
                          : "text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                      )}
                      title={product.is_active ? "Desactivar" : "Reactivar"}
                    >
                      <Ban size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
