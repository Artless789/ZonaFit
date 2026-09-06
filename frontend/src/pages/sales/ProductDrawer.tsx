import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { NumericInput } from '@shared/ui/NumericInput';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { DollarSign } from 'lucide-react';
import { useToast } from '@shared/ui/Toast';
import { productSchema } from '@shared/schemas/productSchema';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
import { useProducts } from '../../hooks/useProducts';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  categories: Category[];
}

export function ProductDrawer({ isOpen, onClose, product, categories }: ProductDrawerProps) {
  const { toast } = useToast();
  const { createMutation, updateMutation } = useProducts();
  const isEditing = !!product;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      category_id: 0,
      description: '',
      purchase_price: 0,
      sale_price: 0,
      stock: 0,
      minimum_stock: 5,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (product) {
        reset({
          name: product.name,
          sku: product.sku,
          category_id: product.category_id,
          description: product.description || '',
          purchase_price: product.purchase_price,
          sale_price: product.sale_price,
          stock: product.stock,
          minimum_stock: product.minimum_stock,
        });
      } else {
        reset({
          name: '',
          sku: '',
          category_id: categories.length > 0 ? categories[0].id : 0,
          description: '',
          purchase_price: 0,
          sale_price: 0,
          stock: 0,
          minimum_stock: 5,
        });
      }
    }
  }, [isOpen, product, reset, categories]);

  const onSubmit = async (data: any) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: product.id, data });
        toast({ type: 'success', title: 'Producto Actualizado', message: 'Inventario actualizado correctamente.' });
      } else {
        await createMutation.mutateAsync(data);
        toast({ type: 'success', title: 'Producto Creado', message: 'El producto fue agregado al inventario.' });
      }
      onClose();
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo guardar la información del producto.',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  
  const categoryOptions = categories
    .filter(c => c.is_active || (isEditing && product?.category_id === c.id))
    .map(c => ({ value: c.id, label: c.name }));

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex flex-col gap-6 flex-1">
          
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Código SKU"
              className="col-span-1"
              placeholder="Ej. AGUA-500"
              error={!!errors.sku}
              helperText={errors.sku?.message as string}
              disabled={isSaving}
              {...register('sku')}
            />
            <Input
              label="Nombre del Producto"
              className="col-span-2"
              placeholder="Ej. Botella de Agua 500ml"
              error={!!errors.name}
              helperText={errors.name?.message as string}
              disabled={isSaving}
              {...register('name')}
            />
          </div>

          <Select
            label="Categoría"
            options={categoryOptions}
            error={!!errors.category_id}
            helperText={errors.category_id?.message as string}
            disabled={isSaving}
            {...register('category_id')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="purchase_price"
              control={control}
              render={({ field }) => (
                <NumericInput
                  label="Precio de Compra (Costo)"
                  placeholder="0"
                  leftIcon={<DollarSign size={16} />}
                  error={!!errors.purchase_price}
                  helperText={errors.purchase_price?.message as string}
                  disabled={isSaving}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Controller
              name="sale_price"
              control={control}
              render={({ field }) => (
                <NumericInput
                  label="Precio de Venta"
                  placeholder="0"
                  leftIcon={<DollarSign size={16} />}
                  error={!!errors.sale_price}
                  helperText={errors.sale_price?.message as string}
                  disabled={isSaving}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="stock"
              control={control}
              render={({ field }) => (
                <NumericInput
                  label="Stock Actual"
                  placeholder="0"
                  error={!!errors.stock}
                  helperText={errors.stock?.message as string}
                  disabled={isSaving}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Controller
              name="minimum_stock"
              control={control}
              render={({ field }) => (
                <NumericInput
                  label="Stock Mínimo (Alerta)"
                  placeholder="5"
                  error={!!errors.minimum_stock}
                  helperText={errors.minimum_stock?.message as string}
                  disabled={isSaving}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted mb-1">Descripción (Opcional)</label>
            <textarea
              rows={3}
              placeholder="Detalles adicionales del producto..."
              className={`w-full rounded-md border ${errors.description ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50`}
              disabled={isSaving}
              {...register('description')}
            />
          </div>

        </div>

        <div className="pt-6 mt-6 border-t border-border-light flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <ActionGlowButton type="submit" isLoading={isSaving} disabled={!isDirty && isEditing}>
            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}
