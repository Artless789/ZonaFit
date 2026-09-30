import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { GlassPanel } from '@shared/ui/GlassPanel';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { COUNTRIES } from '@shared/utils/constants';
import { Building2, MapPin, Mail, Phone, Hash, ShieldAlert } from 'lucide-react';
import type { GymSettingsFormInput } from '@shared/types/gymSettings';

interface GymIdentityTabProps {
  register: UseFormRegister<GymSettingsFormInput>;
  errors: FieldErrors<GymSettingsFormInput>;
  isAdmin: boolean;
  isSaving: boolean;
}

export function GymIdentityTab({
  register,
  errors,
  isAdmin,
  isSaving,
}: GymIdentityTabProps) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {!isAdmin && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <span>
            Estás visualizando la configuración institucional en modo lectura. Solo administradores y propietarios pueden modificar estos datos.
          </span>
        </div>
      )}

      {/* Panel 1: Identificación Legal */}
      <GlassPanel
        index="01"
        eyebrow="IDENTIFICACIÓN INSTITUCIONAL"
        title="Datos Legales y Comerciales"
        description="Información fiscal utilizada en facturas electrónicas, contratos de membresía y recibos oficiales."
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Razón Social (Legal Name)"
            placeholder="Ej. Merwil ZonaFit S.A.S."
            disabled={!isAdmin || isSaving}
            error={!!errors.legal_name}
            helperText={errors.legal_name?.message as string}
            leftIcon={<Building2 size={16} className="text-text-muted" />}
            {...register('legal_name')}
          />

          <Input
            label="Nombre Comercial (Trade Name)"
            placeholder="Ej. Merwil ZonaFit Sede Principal"
            disabled={!isAdmin || isSaving}
            error={!!errors.trade_name}
            helperText={errors.trade_name?.message as string}
            leftIcon={<Building2 size={16} className="text-text-muted" />}
            {...register('trade_name')}
          />

          <Input
            label="NIT / Registro Tributario (Tax ID)"
            placeholder="Ej. 901.234.567-8"
            disabled={!isAdmin || isSaving}
            error={!!errors.tax_id}
            helperText={errors.tax_id?.message as string}
            leftIcon={<Hash size={16} className="text-text-muted" />}
            {...register('tax_id')}
          />

          <Input
            label="Régimen Fiscal"
            placeholder="Ej. Régimen Común / Simplificado / No Responsable de IVA"
            disabled={!isAdmin || isSaving}
            error={!!errors.tax_regime}
            helperText={errors.tax_regime?.message as string}
            {...register('tax_regime')}
          />
        </div>
      </GlassPanel>

      {/* Panel 2: Ubicación y Contacto */}
      <GlassPanel
        index="02"
        eyebrow="UBICACIÓN Y CONTACTO"
        title="Sede Física y Canales Oficiales"
        description="Puntos de contacto oficiales que verán los clientes en sus comprobantes y notificaciones."
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Teléfono Oficial de Contacto"
            placeholder="Ej. +57 300 123 4567"
            disabled={!isAdmin || isSaving}
            error={!!errors.official_phone}
            helperText={errors.official_phone?.message as string}
            leftIcon={<Phone size={16} className="text-text-muted" />}
            {...register('official_phone')}
          />

          <Input
            label="Correo Electrónico Institucional"
            type="email"
            placeholder="contacto@zonafit.com"
            disabled={!isAdmin || isSaving}
            error={!!errors.official_email}
            helperText={errors.official_email?.message as string}
            leftIcon={<Mail size={16} className="text-text-muted" />}
            {...register('official_email')}
          />

          <Input
            label="Dirección Física de la Sede"
            placeholder="Calle 10 # 40-20, Barrio El Poblado"
            disabled={!isAdmin || isSaving}
            error={!!errors.physical_address}
            helperText={errors.physical_address?.message as string}
            leftIcon={<MapPin size={16} className="text-text-muted" />}
            {...register('physical_address')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              options={COUNTRIES.map((c) => ({ value: c, label: c }))}
              {...register('country')}
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
