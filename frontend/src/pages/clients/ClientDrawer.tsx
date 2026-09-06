import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { clientSchema, ClientFormValues } from '@shared/schemas/clientSchema';
import type { Client } from '@shared/types/client';
import { useClients } from '../../hooks/useClients';
import { api } from '../../services/api';
import { User as UserIcon, Upload, X } from 'lucide-react';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';

import { useQueryClient } from '@tanstack/react-query';

interface ClientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
}

export function ClientDrawer({ isOpen, onClose, client }: ClientDrawerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createMutation, updateMutation } = useClients();
  const isEditing = !!client;

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      document_type: 'CC',
      full_name: '',
      document: '',
      phone: '',
      email: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (client) {
        reset({
          full_name: client.full_name,
          document_type: client.document_type,
          document: client.document,
          phone: client.phone,
          email: client.email || '',
          notes: client.notes || '',
        });
      } else {
        reset({
          document_type: 'CC',
          full_name: '',
          document: '',
          phone: '',
          email: '',
          notes: '',
        });
      }
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [isOpen, client, reset]);

  const uploadPhoto = async (clientId: number) => {
    if (!photoFile) return;
    const formData = new FormData();
    formData.append('file', photoFile);
    await api.post(`/clients/${clientId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['client360'] });
  };

  const onSubmit = async (data: ClientFormValues) => {
    try {
      setIsUploading(true);
      if (isEditing) {
        await updateMutation.mutateAsync({ id: client.id, data });
        if (photoFile) await uploadPhoto(client.id);
        toast({ type: 'success', title: 'Cliente Actualizado', message: 'Datos guardados correctamente.' });
      } else {
        const newClient = await createMutation.mutateAsync(data);
        if (photoFile) await uploadPhoto(newClient.id);
        toast({ type: 'success', title: 'Cliente Creado', message: 'El cliente fue registrado exitosamente.' });
      }
      onClose();
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo guardar la información del cliente.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate
    if (!file.type.startsWith('image/')) {
      toast({ type: 'error', title: 'Archivo Inválido', message: 'Solo se permiten imágenes.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: 'error', title: 'Archivo muy grande', message: 'La imagen no debe superar los 5MB.' });
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex flex-col gap-6 flex-1">
          
          {/* Photo Upload Section */}
          <div className="flex items-center gap-4 p-4 bg-bg-surface/50 border border-border-light rounded-xl">
            <div className="relative w-20 h-20 rounded-full bg-bg-elevated border border-border-medium flex items-center justify-center overflow-hidden shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : client?.photo_url ? (
                <AuthorizedImage src={client.photo_url} alt="Cliente" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={32} className="text-text-muted" />
              )}
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); if(fileInputRef.current) fileInputRef.current.value=''; }}
                  className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <X className="text-white" size={24} />
                </button>
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-text-primary mb-1">Fotografía del Cliente</h4>
              <p className="text-xs text-text-muted mb-2">JPG, PNG o WEBP. Máximo 5MB.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 rounded-lg transition-colors"
              >
                <Upload size={14} />
                {(photoPreview || client?.photo_url) ? 'Cambiar Foto' : 'Subir Foto'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <Input
            label="Nombre Completo"
            placeholder="Ej. Juan Pérez"
            error={!!errors.full_name}
            helperText={errors.full_name?.message}
            disabled={isSaving}
            {...register('full_name')}
          />
          
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Tipo"
              className="col-span-1"
              options={[
                { value: 'CC', label: 'CC' },
                { value: 'CE', label: 'CE' },
                { value: 'PAS', label: 'PAS' },
                { value: 'NIT', label: 'NIT' },
              ]}
              error={!!errors.document_type}
              disabled={isSaving}
              {...register('document_type')}
            />
            <Input
              label="Documento"
              className="col-span-2"
              placeholder="Ej. 1020304050"
              error={!!errors.document}
              helperText={errors.document?.message}
              disabled={isSaving || isEditing} // Can't change document easily if it's the primary identifier
              {...register('document')}
            />
          </div>

          <Input
            label="Teléfono"
            placeholder="Ej. 3001234567"
            error={!!errors.phone}
            helperText={errors.phone?.message}
            disabled={isSaving}
            {...register('phone')}
          />

          <Input
            label="Correo Electrónico (Opcional)"
            type="email"
            placeholder="ejemplo@correo.com"
            error={!!errors.email}
            helperText={errors.email?.message}
            disabled={isSaving}
            {...register('email')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted mb-1">Notas (Opcional)</label>
            <textarea
              rows={4}
              placeholder="Condiciones médicas, observaciones especiales..."
              className={`w-full rounded-md border ${errors.notes ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50`}
              disabled={isSaving}
              {...register('notes')}
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
          <ActionGlowButton type="submit" isLoading={isSaving} disabled={!isDirty && !photoFile && isEditing}>
            {isEditing ? 'Guardar Cambios' : 'Registrar Cliente'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}
