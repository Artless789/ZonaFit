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
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
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
    <div className="w-full overflow-x-auto rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Producto / SKU</th>
            <th scope="col" className="px-6 py-4 font-semibold">Categoría</th>
            <th scope="col" className="px-6 py-4 font-semibold">Precio Venta</th>
            <th scope="col" className="px-6 py-4 font-semibold">Stock</th>
            <th scope="col" className="px-6 py-4 font-semibold">Estado</th>
            <th scope="col" className="px-6 py-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {products.map((product) => {
            const isLowStock = product.stock <= product.minimum_stock;
            
            return (
              <tr 
                key={product.id} 
                className={cn("hover:bg-bg-elevated/30 transition-colors group", !product.is_active && "opacity-50")}
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-text-primary">{product.name}</div>
                  <div className="text-xs text-text-muted font-mono">{product.sku}</div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="default" className="bg-bg-page border-border-medium">{getCategoryName(product.category_id)}</Badge>
                </td>
                <td className="px-6 py-4 font-medium text-text-primary">
                  {formatPrice(product.sale_price)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", isLowStock ? "text-danger" : "text-text-primary")}>
                      {product.stock}
                    </span>
                    {isLowStock && <Badge variant="danger" className="text-[10px] px-1.5 py-0">Bajo</Badge>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {product.is_active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="danger">Inactivo</Badge>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(product)}
                      className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                      title="Editar Producto"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onToggleStatus(product)}
                      className={cn(
                        "p-2 rounded-md transition-colors",
                        product.is_active 
                          ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                          : "text-text-muted hover:text-success hover:bg-success/10"
                      )}
                      title={product.is_active ? "Desactivar" : "Reactivar"}
                    >
                      <Ban size={16} />
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
