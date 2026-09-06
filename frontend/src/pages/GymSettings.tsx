import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Badge } from '@shared/ui/Badge';
import { useToast } from '@shared/ui/Toast';
import { Skeleton } from '@shared/ui/Skeleton';
import { useGymSettings } from '../hooks/useGymSettings';
import { gymSettingsSchema } from '@shared/schemas/gymSettingsSchema';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Building2, Receipt, ShieldAlert } from 'lucide-react';
import { COUNTRIES, CURRENCIES, TIMEZONES } from '@shared/utils/constants';

export function GymSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'OWNER';

  const { query, createMutation, updateMutation, isNewRecord } = useGymSettings();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(gymSettingsSchema),
    defaultValues: {
      tax_regime: 'Régimen Común',
      city: 'Bogotá',
      country: 'Colombia',
      currency: 'COP',
      timezone: 'America/Bogota',
      default_tax_percentage: 19.00,
      receipt_footer_notes: '¡Gracias por entrenar con nosotros en Merwil ZonaFit!',
    },
  });

  // Populate form when data is fetched successfully
  useEffect(() => {
    if (query.data && !isNewRecord) {
      reset({
        ...query.data,
        tax_regime: query.data.tax_regime ?? '',
        receipt_footer_notes: query.data.receipt_footer_notes ?? '',
        default_tax_percentage: Number(query.data.default_tax_percentage),
      });
    }
  }, [query.data, isNewRecord, reset]);

  const onSubmit = async (data: any) => {
    if (!isAdmin) {
      toast({
        type: 'warning',
        title: 'Acceso Restringido',
        message: 'Solo los administradores pueden modificar estos datos.',
      });
      return;
    }

    const payload = {
      ...data,
      default_tax_percentage: Number(data.default_tax_percentage),
    };

    try {
      if (isNewRecord) {
        await createMutation.mutateAsync(payload);
        toast({
          type: 'success',
          title: 'Configuración Creada',
          message: 'Los datos institucionales han sido registrados con éxito.',
        });
      } else {
        await updateMutation.mutateAsync(payload);
        toast({
          type: 'success',
          title: 'Configuración Actualizada',
          message: 'Los cambios institucionales se guardaron correctamente.',
        });
      }
      // Reset form with new data to clear isDirty state
      reset(payload);
    } catch (err: any) {
      console.error(err);
      
      const detail = err.response?.data?.detail;
      
      if (err.response?.status === 422 && Array.isArray(detail)) {
        // Map Pydantic validation errors to react-hook-form
        detail.forEach((errorItem: any) => {
          const field = errorItem.loc[errorItem.loc.length - 1]; // usually the last item is the field name
          setError(field as any, { type: 'server', message: errorItem.msg });
        });
        
        toast({
          type: 'error',
          title: 'Errores de validación',
          message: 'Por favor, revisa los campos marcados en rojo.',
        });
      } else {
        toast({
          type: 'error',
          title: 'Error al Guardar',
          message: err.userMessage || 'Verifica los campos ingresados e intenta nuevamente.',
        });
      }
    }
  };

  const handleDiscard = () => {
    if (query.data && !isNewRecord) {
      reset({
        ...query.data,
        tax_regime: query.data.tax_regime ?? '',
        receipt_footer_notes: query.data.receipt_footer_notes ?? '',
        default_tax_percentage: Number(query.data.default_tax_percentage),
      });
      toast({
        type: 'info',
        title: 'Cambios descartados',
        message: 'Se ha restaurado la configuración original.',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-32">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 flex flex-col gap-6 p-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (query.isError && !isNewRecord) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">
          {(query.error as any)?.message || 'No se pudo cargar la configuración del gimnasio.'}
        </p>
        <button
          onClick={() => query.refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-32 relative">
      {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary">Configuración del Gimnasio</h1>
            {isNewRecord ? (
              <Badge variant="warning">Pendiente de Registro</Badge>
            ) : (
              <Badge variant="success">Activo</Badge>
            )}
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Información legal e institucional utilizada en facturas, recibos y reportes oficiales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <Link to="/app/notifications">
                <button
                  type="button"
                  className="px-3.5 py-2 text-sm font-medium border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors flex items-center gap-2"
                >
                  <span>WhatsApp Business</span>
                </button>
              </Link>
              <Link to="/settings/subscription">
                <ActionGlowButton>
                  Gestionar Suscripción
                </ActionGlowButton>
              </Link>
            </>
          )}
          {!isAdmin && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-2 rounded-lg">
              <ShieldAlert size={16} />
              <span>Modo Lectura</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        {/* Block 1: Identificación Legal */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-border-light pb-4">
            <Building2 className="text-brand-primary" size={22} />
            <h2 className="text-lg font-semibold text-text-primary">Datos Legales y Comerciales</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Razón Social (Legal Name)"
              placeholder="Ej. Merwil ZonaFit S.A.S."
              disabled={!isAdmin || isSaving}
              error={!!errors.legal_name}
              helperText={errors.legal_name?.message as string}
              {...register('legal_name')}
            />
            <Input
              label="Nombre Comercial (Trade Name)"
              placeholder="Ej. Merwil ZonaFit Sede Poblado"
              disabled={!isAdmin || isSaving}
              error={!!errors.trade_name}
              helperText={errors.trade_name?.message as string}
              {...register('trade_name')}
            />
            <Input
              label="NIT / Registro Tributario (Tax ID)"
              placeholder="Ej. 901.234.567-8"
              disabled={!isAdmin || isSaving}
              error={!!errors.tax_id}
              helperText={errors.tax_id?.message as string}
              {...register('tax_id')}
            />
            <Input
              label="Régimen Fiscal"
              placeholder="Ej. Régimen Común / Simplificado"
              disabled={!isAdmin || isSaving}
              error={!!errors.tax_regime}
              helperText={errors.tax_regime?.message as string}
              {...register('tax_regime')}
            />
          </div>
        </div>

        {/* Block 2: Contacto y Ubicación */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-border-light pb-4">
            <Building2 className="text-brand-primary" size={22} />
            <h2 className="text-lg font-semibold text-text-primary">Ubicación y Contacto Oficial</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Teléfono Oficial"
              placeholder="Ej. +57 300 123 4567"
              disabled={!isAdmin || isSaving}
              error={!!errors.official_phone}
              helperText={errors.official_phone?.message as string}
              {...register('official_phone')}
            />
            <Input
              label="Correo Electrónico Oficial"
              type="email"
              placeholder="contacto@zonafit.com"
              disabled={!isAdmin || isSaving}
              error={!!errors.official_email}
              helperText={errors.official_email?.message as string}
              {...register('official_email')}
            />
            <Input
              label="Dirección Física"
              placeholder="Calle 10 # 40-20"
              disabled={!isAdmin || isSaving}
              error={!!errors.physical_address}
              helperText={errors.physical_address?.message as string}
              {...register('physical_address')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ciudad"
                placeholder="Medellín"
                disabled={!isAdmin || isSaving}
                error={!!errors.city}
                helperText={errors.city?.message as string}
                {...register('city')}
              />
              <Select
                label="País"
                disabled={!isAdmin || isSaving}
                error={!!errors.country}
                helperText={errors.country?.message as string}
                options={COUNTRIES.map(c => ({ value: c, label: c }))}
                {...register('country')}
              />
            </div>
          </div>
        </div>

        {/* Block 3: Facturación e Impuestos */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-border-light pb-4">
            <Receipt className="text-brand-primary" size={22} />
            <h2 className="text-lg font-semibold text-text-primary">Moneda e Impuestos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Select
              label="Moneda Principal"
              options={CURRENCIES}
              disabled={!isAdmin || isSaving}
              error={!!errors.currency}
              helperText={errors.currency?.message as string}
              {...register('currency')}
            />
            <Input
              label="Porcentaje IVA / Impuesto (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="19.00"
              disabled={!isAdmin || isSaving}
              error={!!errors.default_tax_percentage}
              helperText={(errors.default_tax_percentage?.message as string) || 'Entre 0 y 100'}
              {...register('default_tax_percentage')}
            />
            <Select
              label="Zona Horaria"
              disabled={!isAdmin || isSaving}
              error={!!errors.timezone}
              helperText={errors.timezone?.message as string}
              options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
              {...register('timezone')}
            />
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <label className="text-sm font-medium text-text-muted mb-1">
              Pie de Pagina / Notas en Recibo
            </label>
            <textarea
              rows={3}
              placeholder="Mensaje de despedida o términos legales breves para el recibo..."
              disabled={!isAdmin || isSaving}
              className={`w-full rounded-md border ${errors.receipt_footer_notes ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50`}
              {...register('receipt_footer_notes')}
            />
            {errors.receipt_footer_notes && (
              <span className="text-xs text-danger">{errors.receipt_footer_notes.message as string}</span>
            )}
          </div>
        </div>

        {/* Sticky Action Bar */}
        {isAdmin && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-end border-t border-border-light bg-bg-elevated/80 p-4 shadow-glass-up backdrop-blur-md transition-all duration-300 md:left-[var(--app-sidebar-width)]">
            <div className="max-w-[var(--content-max-width)] mx-auto w-full flex justify-end px-container">
                {isDirty && !isNewRecord && (
                 <button
                   type="button"
                   onClick={handleDiscard}
                   className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors mr-3"
                 >
                   Descartar cambios
                 </button>
               )}
               <ActionGlowButton 
                 type="submit" 
                 isLoading={isSaving}
                 disabled={!isDirty && !isNewRecord}
               >
                 {isNewRecord ? 'Guardar Configuración Inicial' : 'Guardar Cambios'}
               </ActionGlowButton>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
