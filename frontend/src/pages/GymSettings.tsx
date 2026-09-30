import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  Building2,
  CreditCard,
  ShieldAlert,
  RefreshCw,
  MapPin,
  Coins,
  MessageCircle,
  Check,
  X
} from 'lucide-react';

import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGymSettings } from '../hooks/useGymSettings';
import { gymSettingsSchema } from '@shared/schemas/gymSettingsSchema';

import type { GymSettingsFormInput } from '@shared/types/gymSettings';

import { SettingsTabs, type SettingsTabId } from './settings/SettingsTabs';
import { GymIdentityTab } from './settings/GymIdentityTab';
import { BillingParametersTab } from './settings/BillingParametersTab';
import { CommunicationsSettingsTab } from './settings/CommunicationsSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';
import { UserProfileTab } from './settings/UserProfileTab';
import { SubscriptionOverviewTab } from './settings/SubscriptionOverviewTab';

export function GymSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'OWNER';

  const [activeTab, setActiveTab] = useState<SettingsTabId>('identity');

  const { query, createMutation, updateMutation, isNewRecord } = useGymSettings();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<GymSettingsFormInput>({
    resolver: zodResolver(gymSettingsSchema) as never,
    defaultValues: {
      legal_name: '',
      trade_name: '',
      tax_id: '',
      tax_regime: 'Régimen Común',
      official_phone: '',
      official_email: '',
      physical_address: '',
      city: 'Bogotá',
      country: 'Colombia',
      currency: 'COP',
      timezone: 'America/Bogota',
      default_tax_percentage: 19.0,
      receipt_footer_notes: '¡Gracias por entrenar con nosotros en Merwil ZonaFit!',
    },
  });

  // Populate form when data is fetched successfully
  useEffect(() => {
    if (query.data && !isNewRecord) {
      reset({
        legal_name: query.data.legal_name || '',
        trade_name: query.data.trade_name || '',
        tax_id: query.data.tax_id || '',
        tax_regime: query.data.tax_regime ?? '',
        official_phone: query.data.official_phone || '',
        official_email: query.data.official_email || '',
        physical_address: query.data.physical_address || '',
        city: query.data.city || 'Bogotá',
        country: query.data.country || 'Colombia',
        currency: query.data.currency || 'COP',
        timezone: query.data.timezone || 'America/Bogota',
        receipt_footer_notes: query.data.receipt_footer_notes ?? '',
        default_tax_percentage: Number(query.data.default_tax_percentage),
      });
    }
  }, [query.data, isNewRecord, reset]);

  const onSubmit = async (data: GymSettingsFormInput) => {
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
      reset(payload);
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as {
        response?: {
          status?: number;
          data?: { detail?: Array<{ loc: string[]; msg: string }> };
        };
        userMessage?: string;
      };
      const detail = errorObj.response?.data?.detail;

      if (errorObj.response?.status === 422 && Array.isArray(detail)) {
        detail.forEach((errorItem) => {
          const field = errorItem.loc[errorItem.loc.length - 1];
          setError(field as keyof GymSettingsFormInput, { type: 'server', message: errorItem.msg });
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
          message: errorObj.userMessage || 'Verifica los campos ingresados e intenta nuevamente.',
        });
      }
    }
  };

  const handleDiscard = () => {
    if (query.data && !isNewRecord) {
      reset({
        legal_name: query.data.legal_name || '',
        trade_name: query.data.trade_name || '',
        tax_id: query.data.tax_id || '',
        tax_regime: query.data.tax_regime ?? '',
        official_phone: query.data.official_phone || '',
        official_email: query.data.official_email || '',
        physical_address: query.data.physical_address || '',
        city: query.data.city || 'Bogotá',
        country: query.data.country || 'Colombia',
        currency: query.data.currency || 'COP',
        timezone: query.data.timezone || 'America/Bogota',
        receipt_footer_notes: query.data.receipt_footer_notes ?? '',
        default_tax_percentage: Number(query.data.default_tax_percentage),
      });
      toast({
        type: 'info',
        title: 'Cambios descartados',
        message: 'Se ha restaurado la configuración guardada del gimnasio.',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Loading Skeleton
  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-24 animate-in fade-in duration-300">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  // Error State with Retry
  if (query.isError && !isNewRecord) {
    return (
      <div className="rounded-3xl border border-border-light bg-surface-raised/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-12 backdrop-blur-md">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {(query.error as Error)?.message || 'No se pudo cargar la configuración del gimnasio desde el servidor.'}
        </p>
        <button
          onClick={() => query.refetch()}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all cursor-pointer shadow-glow"
        >
          <RefreshCw size={14} />
          <span>Reintentar Conexión</span>
        </button>
      </div>
    );
  }

  const gymTradeName = query.data?.trade_name || 'Gimnasio Sin Registrar';
  const gymTaxId = query.data?.tax_id || 'Sin NIT';
  const gymCity = query.data?.city || 'Colombia';
  const gymCurrency = query.data?.currency || 'COP';
  const gymTax = query.data?.default_tax_percentage || 0;

  return (
    <div className="flex flex-col gap-6 pb-28 relative">
      {/* Editorial Header */}
      <SectionEyebrow
        index="10"
        label="SISTEMA // CENTRO DE CONTROL"
        title="Configuración Administrativa"
        description="Gestión institucional del gimnasio, parámetros fiscales y comerciales, comunicaciones directas y preferencias de usuario."
        action={
          <div className="flex items-center gap-3">
            {isNewRecord ? (
              <StatusBadge status="warning" label="PENDIENTE DE REGISTRO" mode="pill" size="sm" />
            ) : (
              <StatusBadge status="active" label="SISTEMA ACTIVO" mode="pill" size="sm" />
            )}

            <Link to="/settings/subscription">
              <ActionGlowButton className="gap-2 shrink-0">
                <CreditCard size={15} />
                <span>Suscripción</span>
              </ActionGlowButton>
            </Link>
          </div>
        }
      />

      {/* Control Center HUD / Quick Highlights Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl border border-border-light bg-surface-raised/40 backdrop-blur-md flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Building2 size={12} className="text-brand-primary" />
            <span>Establecimiento</span>
          </span>
          <p className="text-xs font-bold text-text-primary truncate" title={gymTradeName}>
            {gymTradeName}
          </p>
          <span className="font-mono text-[10px] text-text-secondary truncate">
            NIT: {gymTaxId}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border-light bg-surface-raised/40 backdrop-blur-md flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <MapPin size={12} className="text-brand-primary" />
            <span>Sede Principal</span>
          </span>
          <p className="text-xs font-bold text-text-primary truncate">
            {gymCity}
          </p>
          <span className="font-mono text-[10px] text-text-secondary truncate">
            {query.data?.tax_regime || 'Régimen Comercial'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border-light bg-surface-raised/40 backdrop-blur-md flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Coins size={12} className="text-brand-primary" />
            <span>Parámetros Fiscales</span>
          </span>
          <p className="text-xs font-bold text-text-primary font-mono">
            {gymCurrency} · IVA {gymTax}%
          </p>
          <span className="font-mono text-[10px] text-text-secondary truncate">
            {query.data?.timezone || 'America/Bogota'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border-light bg-surface-raised/40 backdrop-blur-md flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <MessageCircle size={12} />
            <span>WhatsApp Web</span>
          </span>
          <p className="text-xs font-bold text-emerald-400 font-mono">
            DIRECTO & SEGURO
          </p>
          <span className="font-mono text-[10px] text-text-secondary truncate">
            Sin costos por mensaje
          </span>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <SettingsTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isGymDirty={isDirty}
      />

      {/* Form wrapper for Gym settings (Identity and Billing) */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div id={`settings-tabpanel-${activeTab}`} role="tabpanel">
          {activeTab === 'identity' && (
            <GymIdentityTab
              register={register}
              errors={errors}
              isAdmin={isAdmin}
              isSaving={isSaving}
            />
          )}

          {activeTab === 'billing' && (
            <BillingParametersTab
              register={register}
              errors={errors}
              watch={watch}
              isAdmin={isAdmin}
              isSaving={isSaving}
            />
          )}

          {activeTab === 'communications' && (
            <CommunicationsSettingsTab />
          )}

          {activeTab === 'appearance' && (
            <AppearanceSettingsTab />
          )}

          {activeTab === 'profile' && (
            <UserProfileTab />
          )}

          {activeTab === 'subscription' && (
            <SubscriptionOverviewTab />
          )}
        </div>

        {/* Sticky Action Save Bar when Gym Settings are Dirty */}
        {isAdmin && isDirty && (activeTab === 'identity' || activeTab === 'billing') && (
          <div className="fixed bottom-4 left-4 right-4 md:left-[calc(var(--app-sidebar-width)+2rem)] md:right-8 z-40 animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto">
            <div className="liquid-glass flex items-center justify-between gap-4 p-4 rounded-2xl border border-amber-500/40 shadow-glow bg-surface-raised/95 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="size-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-text-primary">
                    Tienes cambios pendientes de guardar
                  </span>
                  <span className="text-[11px] text-text-secondary hidden sm:inline">
                    Guarda los cambios institucionales para reflejarlos en las facturas y comprobantes.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {!isNewRecord && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X size={14} />
                    <span>Descartar</span>
                  </button>
                )}

                <ActionGlowButton
                  type="submit"
                  isLoading={isSaving}
                  className="gap-2 cursor-pointer shadow-glow"
                >
                  <Check size={16} />
                  <span>{isNewRecord ? 'Crear Configuración' : 'Guardar Cambios'}</span>
                </ActionGlowButton>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
