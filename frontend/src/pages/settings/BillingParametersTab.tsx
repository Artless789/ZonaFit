import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { GlassPanel } from '@shared/ui/GlassPanel';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { CURRENCIES, TIMEZONES } from '@shared/utils/constants';
import { Coins, Percent, FileText, Info } from 'lucide-react';
import type { GymSettingsFormInput } from '@shared/types/gymSettings';

interface BillingParametersTabProps {
  register: UseFormRegister<GymSettingsFormInput>;
  errors: FieldErrors<GymSettingsFormInput>;
  watch: UseFormWatch<GymSettingsFormInput>;
  isAdmin: boolean;
  isSaving: boolean;
}

// Backend supports COP, USD, EUR in GymSettings validator
const ALLOWED_CURRENCIES = CURRENCIES.filter((c) =>
  ['COP', 'USD', 'EUR'].includes(c.value)
);

export function BillingParametersTab({
  register,
  errors,
  watch,
  isAdmin,
  isSaving,
}: BillingParametersTabProps) {
  const currentFooter = watch('receipt_footer_notes') || '';
  const currentCurrency = watch('currency') || 'COP';
  const currentTax = watch('default_tax_percentage') || 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Panel 1: Parámetros Monetarios y Fiscales */}
      <GlassPanel
        index="01"
        eyebrow="PARÁMETROS ECONÓMICOS"
        title="Moneda, Impuestos y Zona Horaria"
        description="Configuración base aplicada de forma automática a los cálculos de POS, planes de membresía y cierres de caja."
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Select
            label="Moneda Operativa"
            options={ALLOWED_CURRENCIES}
            disabled={!isAdmin || isSaving}
            error={!!errors.currency}
            helperText={(errors.currency?.message as string) || 'Moneda oficial para registro contable'}
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
            helperText={(errors.default_tax_percentage?.message as string) || 'Tarifa fiscal por defecto (0 a 100%)'}
            leftIcon={<Percent size={16} className="text-text-muted" />}
            {...register('default_tax_percentage')}
          />

          <Select
            label="Zona Horaria del Establecimiento"
            disabled={!isAdmin || isSaving}
            error={!!errors.timezone}
            helperText={(errors.timezone?.message as string) || 'Horario oficial para sellos de tiempo'}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            {...register('timezone')}
          />
        </div>

        {/* Informative summary card */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border-light bg-surface-raised/40 text-xs text-text-secondary mt-2">
          <Coins size={18} className="text-brand-primary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-text-primary">Impacto contable directo:</span>
            <p>
              Las ventas emitidas aplicarán la moneda <strong className="text-text-primary">{currentCurrency}</strong> con un IVA del{' '}
              <strong className="text-text-primary">{currentTax}%</strong> salvo que se configure exención manual en el catálogo de productos.
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Panel 2: Pie de Página en Comprobantes */}
      <GlassPanel
        index="02"
        eyebrow="FORMATO DE COMPROBANTES"
        title="Notas Legales y Pie de Página en Recibos"
        description="Texto institucional que se incluye al pie de los recibos impresos, comprobantes de pago POS y facturas enviadas."
        rounded="2xl"
        padding="md"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label 
              htmlFor="receipt_footer_notes" 
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5"
            >
              <FileText size={14} className="text-brand-primary" />
              <span>Texto al pie de los recibos</span>
            </label>
            <span className="font-mono text-[11px] text-text-muted">
              {currentFooter.length} caracteres
            </span>
          </div>

          <textarea
            id="receipt_footer_notes"
            rows={4}
            placeholder="Ej. ¡Gracias por entrenar con nosotros en Merwil ZonaFit! Conserve este recibo para cualquier reclamo o aclaración sobre su plan de entrenamiento."
            disabled={!isAdmin || isSaving}
            className={`w-full rounded-xl border ${
              errors.receipt_footer_notes ? 'border-danger' : 'border-border-medium'
            } bg-surface-base/60 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 transition-all duration-200 disabled:opacity-50`}
            {...register('receipt_footer_notes')}
          />
          {errors.receipt_footer_notes && (
            <span className="text-xs text-danger">{errors.receipt_footer_notes.message as string}</span>
          )}

          <div className="flex items-start gap-2 text-xs text-text-muted mt-1">
            <Info size={14} className="shrink-0 mt-0.5 text-text-muted" />
            <span>
              Tip: Puedes agregar aquí tus políticas breves de cancelación, teléfono de emergencias o mensaje motivacional para los socios del gimnasio.
            </span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
