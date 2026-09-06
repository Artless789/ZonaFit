import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@shared/ui/Modal';
import { Input } from '@shared/ui/Input';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { Badge } from '@shared/ui/Badge';
import { categorySchema, CategoryFormValues } from '@shared/schemas/categorySchema';
import type { Category } from '@shared/types/category';
import { useCategories } from '../../hooks/useCategories';
import { Edit2, Ban, Tag } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
}

export function CategoryModal({ isOpen, onClose, categories }: CategoryModalProps) {
  const { toast } = useToast();
  const { createMutation, updateMutation, deleteMutation } = useCategories();
  
  const [editingId, setEditingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  });

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    reset({ name: category.name, description: category.description || '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    reset({ name: '', description: '' });
  };

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
        toast({ type: 'success', title: 'Categoría Actualizada' });
        handleCancelEdit();
      } else {
        await createMutation.mutateAsync(data);
        toast({ type: 'success', title: 'Categoría Creada' });
        reset();
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: 'No se pudo guardar la categoría.' });
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      if (category.is_active) {
        await deleteMutation.mutateAsync(category.id);
      } else {
        await updateMutation.mutateAsync({ id: category.id, data: { is_active: true } });
      }
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado.' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestión de Categorías">
      <div className="flex flex-col gap-6">
        
        {/* Form to create/edit */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 bg-bg-page p-4 rounded-xl border border-border-light">
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Tag size={16} className="text-brand-primary" />
            {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              placeholder="Ej. Suplementos"
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={isSaving}
              {...register('name')}
            />
            <Input
              label="Descripción (Opcional)"
              placeholder="Proteínas, pre-entrenos..."
              error={!!errors.description}
              helperText={errors.description?.message}
              disabled={isSaving}
              {...register('description')}
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
            )}
            <ActionGlowButton type="submit" isLoading={isSaving}>
              {editingId ? 'Guardar Cambios' : 'Agregar Categoría'}
            </ActionGlowButton>
          </div>
        </form>

        {/* List of existing categories */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
          {categories.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-sm">No hay categorías registradas.</div>
          ) : (
            categories.map(category => (
              <div 
                key={category.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border border-border-light bg-bg-surface transition-colors",
                  !category.is_active && "opacity-60",
                  editingId === category.id && "border-brand-primary/50 bg-brand-primary/5"
                )}
              >
                <div>
                  <div className="font-medium text-text-primary text-sm flex items-center gap-2">
                    {category.name}
                    {!category.is_active && <Badge variant="danger" className="text-[10px] px-1.5 py-0">Inactiva</Badge>}
                  </div>
                  {category.description && (
                    <div className="text-xs text-text-muted mt-0.5 truncate max-w-[200px]">{category.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(category)}
                    className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                    disabled={isSaving}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(category)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      category.is_active 
                        ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                        : "text-text-muted hover:text-success hover:bg-success/10"
                    )}
                    disabled={isSaving}
                  >
                    <Ban size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
