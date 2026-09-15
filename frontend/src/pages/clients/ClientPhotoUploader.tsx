import React, { useRef, useState, useEffect, useId } from 'react';
import { Upload, Camera, Trash2, RotateCcw, User as UserIcon } from 'lucide-react';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

export interface ClientPhotoUploaderProps {
  currentPhotoUrl?: string | null;
  onPhotoSelected: (file: File | null) => void;
  onPhotoRemoved?: () => void;
  disabled?: boolean;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ClientPhotoUploader({
  currentPhotoUrl,
  onPhotoSelected,
  onPhotoRemoved,
  disabled = false,
}: ClientPhotoUploaderProps) {
  const { toast } = useToast();
  const fileInputId = useId();
  const cameraInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset internal preview when external photo URL changes
  useEffect(() => {
    setPreviewUrl(null);
    setIsDeleted(false);
  }, [currentPhotoUrl]);

  const processFile = (file: File) => {
    const fileType = file.type ? file.type.toLowerCase() : '';
    const fileExt = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
    const isAllowedType = ALLOWED_MIME_TYPES.includes(fileType) || (!!fileExt && ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt));

    if (!isAllowedType) {
      toast({
        type: 'error',
        title: 'Formato no compatible',
        message: 'Selecciona una imagen válida en formato JPG, PNG o WEBP.',
      });
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        type: 'error',
        title: 'Imagen demasiado grande',
        message: 'La imagen supera el tamaño máximo permitido de 5MB.',
      });
      return false;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsDeleted(false);
    onPhotoSelected(file);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset inputs so the same file can be selected again if needed
    e.target.value = '';
  };

  const handleClearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onPhotoSelected(null);
  };

  const handleRemoveExistingPhoto = () => {
    handleClearSelection();
    setIsDeleted(true);
    if (onPhotoRemoved) {
      onPhotoRemoved();
    }
  };

  const handleUndoRemove = () => {
    setIsDeleted(false);
  };

  // Determine what image to display in the preview circle
  const hasPendingNewPhoto = !!previewUrl;
  const hasSavedPhoto = !!currentPhotoUrl && !isDeleted;

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-bg-surface/50 border border-border-light rounded-xl">
      {/* Accessible native file inputs (sr-only instead of hidden ensures mobile WebKit allows activation) */}
      <input
        id={fileInputId}
        type="file"
        ref={fileInputRef}
        className="sr-only"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <input
        id={cameraInputId}
        type="file"
        ref={cameraInputRef}
        className="sr-only"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {/* Avatar Preview */}
      <div className="relative w-24 h-24 rounded-full bg-bg-elevated border-2 border-border-medium flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
        {hasPendingNewPhoto ? (
          <img
            src={previewUrl!}
            alt="Vista previa"
            className="w-full h-full object-cover"
          />
        ) : hasSavedPhoto ? (
          <AuthorizedImage
            src={currentPhotoUrl!}
            alt="Fotografía del cliente"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-text-muted">
            <UserIcon size={36} />
          </div>
        )}

        {isDeleted && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center text-red-400 p-1 text-center">
            <Trash2 size={20} className="mb-1" />
            <span className="text-[10px] font-semibold leading-tight">Foto eliminada</span>
          </div>
        )}
      </div>

      {/* Controls & Details */}
      <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
        <h4 className="text-sm font-semibold text-text-primary mb-0.5">
          Fotografía del Cliente
        </h4>
        <p className="text-xs text-text-muted mb-3">
          JPG, PNG o WEBP. Máximo 5MB.
        </p>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          {/* Primary Option: Seleccionar foto */}
          <label
            htmlFor={fileInputId}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-lg transition-colors select-none shadow-sm",
              disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"
            )}
            title="Seleccionar imagen desde tu dispositivo"
          >
            <Upload size={13} className="pointer-events-none" />
            <span className="pointer-events-none">Seleccionar foto</span>
          </label>

          {/* Secondary Option: Tomar foto */}
          <label
            htmlFor={cameraInputId}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cameraInputRef.current?.click();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-white/10 hover:text-text-primary border border-border-light rounded-lg transition-colors select-none",
              disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"
            )}
            title="Tomar foto con la cámara del dispositivo"
          >
            <Camera size={13} className="pointer-events-none" />
            <span className="pointer-events-none">Tomar foto</span>
          </label>

          {/* Actions depending on pending changes */}
          {hasPendingNewPhoto && (
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
              title="Cancelar selección de nueva fotografía"
            >
              <RotateCcw size={12} />
              <span>Deshacer selección</span>
            </button>
          )}

          {!hasPendingNewPhoto && hasSavedPhoto && (
            <button
              type="button"
              onClick={handleRemoveExistingPhoto}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-danger hover:text-danger/90 hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
              title="Quitar fotografía del cliente"
            >
              <Trash2 size={12} />
              <span>Eliminar foto</span>
            </button>
          )}

          {isDeleted && (
            <button
              type="button"
              onClick={handleUndoRemove}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary/90 hover:bg-brand-primary/10 rounded-lg transition-colors cursor-pointer"
              title="Restaurar fotografía anterior"
            >
              <RotateCcw size={12} />
              <span>Restaurar</span>
            </button>
          )}
        </div>

        {hasPendingNewPhoto && (
          <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Nueva fotografía lista para guardar con los cambios del cliente.
          </p>
        )}
      </div>
    </div>
  );
}
