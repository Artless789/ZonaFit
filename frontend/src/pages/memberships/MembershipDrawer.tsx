import { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Select } from '@shared/ui/Select';
import { NumericInput } from '@shared/ui/NumericInput';
import { ClientSearchCombobox } from '@shared/ui/ClientSearchCombobox';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { membershipSchema, type MembershipFormValues } from '@shared/schemas/membershipSchema';
import { useMemberships } from '../../hooks/useMemberships';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useGymSettings } from '../../hooks/useGymSettings';
import { generateMembershipPaymentReceiptPDF, type GenerateMembershipReceiptProps } from '@shared/utils/pdfGenerator';
import type { Client } from '@shared/types/client';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import type { Membership, MembershipCreate } from '@shared/types/membership';
import { formatCurrency } from '@shared/utils/formatters';
import { format, addDays, parse, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Banknote,
  Smartphone,
  CreditCard,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PaymentSuccessModal } from '@shared/ui/PaymentSuccessModal';
import { useWhatsAppWeb } from '../../hooks/useWhatsAppWeb';
import { cn } from '@shared/utils/cn';

interface MembershipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  plans: MembershipPlan[];
  initialClientId?: number | null;
  initialPlanId?: number | null;
  isRenewal?: boolean;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
  { value: 'TRANSFER', label: 'Transferencia', icon: Smartphone },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
];

export function MembershipDrawer({
  isOpen,
  onClose,
  clients,
  plans,
  initialClientId = null,
  initialPlanId = null,
  isRenewal = false,
}: MembershipDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createMutation, query: membershipsQuery } = useMemberships();
  const { activeRegister } = useCashRegisters();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  const [completedReceipt, setCompletedReceipt] = useState<GenerateMembershipReceiptProps | null>(null);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      client_id: initialClientId || 0,
      membership_plan_id: initialPlanId || 0,
      trainer_name: '',
      start_date: todayStr,
      discount: 0,
      register_payment: true,
      payment_method: 'CASH',
      amount_paid: 0,
      reference: '',
    },
  });

  const selectedClientId = useWatch({ control, name: 'client_id' });
  const selectedPlanId = useWatch({ control, name: 'membership_plan_id' });
  const startDateWatched = useWatch({ control, name: 'start_date' });
  const startDateValue = startDateWatched || todayStr;
  const discountRaw = useWatch({ control, name: 'discount' });
  const registerPayment = useWatch({ control, name: 'register_payment' });
  const paymentMethodWatched = useWatch({ control, name: 'payment_method' });
  const paymentMethod = paymentMethodWatched || 'CASH';
  const amountPaidRaw = useWatch({ control, name: 'amount_paid' });

  const activeClients = useMemo(() => clients.filter((c) => c.is_active), [clients]);
  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);

  const selectedPlan = useMemo(() => {
    return activePlans.find((p) => p.id === Number(selectedPlanId)) || null;
  }, [activePlans, selectedPlanId]);

  const selectedClient = useMemo(() => {
    return activeClients.find((c) => c.id === Number(selectedClientId)) || null;
  }, [activeClients, selectedClientId]);

  // Check if selected client has an active membership currently
  const clientActiveMembership = useMemo(() => {
    if (!selectedClientId) return null;
    const allMemberships = (Array.isArray(membershipsQuery.data)
      ? membershipsQuery.data
      : membershipsQuery.data?.items) || [];
    const now = new Date().getTime();
    return (
      allMemberships.find((m) => {
        if (m.client_id !== Number(selectedClientId) || !m.is_active) return false;
        try {
          const end = parseISO(m.end_date).getTime();
          return end > now;
        } catch {
          return false;
        }
      }) || null
    );
  }, [selectedClientId, membershipsQuery.data]);

  const basePrice = selectedPlan ? Number(selectedPlan.price) : 0;
  const discount = Math.min(
    basePrice,
    Math.max(
      0,
      typeof discountRaw === 'number'
        ? discountRaw
        : parseFloat(String(discountRaw || '').replace(/[^0-9.-]+/g, '')) || 0
    )
  );
  const planTotal = Math.max(0, basePrice - discount);

  useEffect(() => {
    if (selectedPlan && registerPayment) {
      setValue('amount_paid', planTotal, { shouldValidate: true });
    }
  }, [selectedPlan, registerPayment, planTotal, setValue]);

  // Reset form when drawer opens or initial props change
  useEffect(() => {
    if (isOpen) {
      reset({
        client_id: initialClientId || 0,
        membership_plan_id: initialPlanId || 0,
        trainer_name: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0,
        register_payment: true,
        payment_method: 'CASH',
        amount_paid: 0,
        reference: '',
      });
    }
  }, [isOpen, initialClientId, initialPlanId, reset]);

  const calculatedEndDate = useMemo(() => {
    if (!selectedPlan || !startDateValue) return null;
    try {
      const parsedStart = parse(startDateValue, 'yyyy-MM-dd', new Date());
      const end = addDays(parsedStart, selectedPlan.duration_days);
      return {
        formatted: format(end, "d 'de' MMMM, yyyy", { locale: es }),
        short: format(end, 'dd/MM/yyyy'),
        dateObj: end,
      };
    } catch {
      return null;
    }
  }, [selectedPlan, startDateValue]);

  const paidAmount = registerPayment
    ? typeof amountPaidRaw === 'number'
      ? amountPaidRaw
      : parseFloat(String(amountPaidRaw).replace(/[^0-9.-]+/g, '')) || 0
    : 0;
  const pendingBalance = Math.max(0, planTotal - paidAmount);

  const planOptions = activePlans.map((p) => ({
    value: p.id,
    label: `${p.name} - ${formatCurrency(p.price)} (${p.duration_days} días)`,
  }));

  const handleDownloadReceipt = async () => {
    if (!completedReceipt) return;
    try {
      await generateMembershipPaymentReceiptPDF(completedReceipt);
    } catch {
      toast({
        type: 'error',
        title: 'Error de Descarga',
        message: 'No se pudo generar el comprobante PDF.',
      });
    }
  };

  const onSubmit = async (data: MembershipFormValues) => {
    if (registerPayment && paidAmount > planTotal) {
      toast({
        type: 'error',
        title: 'Monto Excedido',
        message: `El monto pagado (${formatCurrency(paidAmount)}) no puede superar el costo del plan (${formatCurrency(planTotal)}).`,
      });
      return;
    }

    // Cash register validation
    if (registerPayment && paidAmount > 0 && data.payment_method === 'CASH' && !activeRegister.data) {
      toast({
        type: 'error',
        title: 'Caja Cerrada',
        message: 'Debes abrir una caja de turno antes de registrar pagos de membresía en efectivo.',
      });
      return;
    }

    let created: Membership | undefined;
    try {
      const payload: MembershipCreate = {
        client_id: data.client_id,
        membership_plan_id: data.membership_plan_id,
        trainer_name: data.trainer_name || undefined,
        start_date: new Date(`${data.start_date}T00:00:00Z`).toISOString(),
        discount: discount,
        register_payment: data.register_payment,
        payment_method: data.register_payment ? data.payment_method : undefined,
        amount_paid: data.register_payment ? paidAmount : 0,
        reference: data.register_payment && data.reference ? data.reference : undefined,
      };

      created = await createMutation.mutateAsync(payload);
    } catch (error: unknown) {
      let errorDetail = 'Error al registrar la membresía.';
      if (axios.isAxiosError(error)) {
        errorDetail =
          error.response?.data?.detail ||
          error.response?.data?.error?.message ||
          error.message;
      } else if (error instanceof Error) {
        errorDetail = error.message;
      }
      toast({
        type: 'error',
        title: 'Error al Guardar',
        message: errorDetail,
      });
      return;
    }

    try {
      queryClient.invalidateQueries({ queryKey: ['memberships'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['client360'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivables'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
    } catch {
      // Ignore cache invalidation issues
    }

    if (data.register_payment && paidAmount > 0) {
      const receiptData: GenerateMembershipReceiptProps = {
        receiptNumber: `REC-MEM-${created?.id || 'NUEVO'}`,
        paymentDate: new Date(),
        clientName: selectedClient?.full_name || 'Cliente Merwil ZonaFit',
        clientDocument: selectedClient?.document || 'N/A',
        clientPhone: selectedClient?.phone,
        planName: selectedPlan?.name || 'Membresía',
        durationDays: selectedPlan?.duration_days,
        startDate: data.start_date,
        endDate:
          calculatedEndDate?.dateObj ||
          (created?.end_date ? new Date(created.end_date) : new Date()),
        basePrice: basePrice,
        discount: discount,
        totalPrice: planTotal,
        paidAmount: paidAmount,
        pendingBalance: pendingBalance,
        paymentMethod: data.payment_method || 'CASH',
        gymName:
          gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
        gymNit: gymSettings?.tax_id,
        gymPhone: gymSettings?.official_phone,
        gymAddress: gymSettings?.physical_address,
        gymCity: gymSettings?.city,
        receiptFooterNotes: gymSettings?.receipt_footer_notes,
      };

      setCompletedReceipt(receiptData);
      onClose();
    } else {
      toast({
        type: 'success',
        title: isRenewal ? 'Membresía Renovada' : 'Membresía Asignada',
        message:
          pendingBalance > 0
            ? `Registrada con saldo pendiente de ${formatCurrency(pendingBalance)} en Cuentas por Cobrar.`
            : 'Plan asignado exitosamente.',
      });
      onClose();
    }
  };

  const isSaving = createMutation.isPending;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={isRenewal ? 'Renovación de Membresía' : 'Asignar Membresía a Socio'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-full">
          <div className="flex flex-col gap-5 flex-1 pb-6">
            {/* Contextual Banner if Renewal or Active Member */}
            {clientActiveMembership && (
              <div className="p-3.5 rounded-[var(--radius-lg)] bg-brand-primary/10 border border-brand-primary/20 flex items-start gap-2.5">
                <RotateCcw size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <strong className="text-text-primary block font-semibold">
                    Renovación con cobertura continua
                  </strong>
                  Este socio cuenta con una membresía activa hasta el{' '}
                  <span className="font-bold text-text-primary">
                    {format(parseISO(clientActiveMembership.end_date), "d 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </span>
                  . La nueva vigencia extenderá su acceso sin perder los días restantes.
                </div>
              </div>
            )}

            {/* 1. Client Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Socio / Cliente <span className="text-rose-400">*</span>
              </label>
              <ClientSearchCombobox
                clients={activeClients}
                selectedClientId={selectedClientId}
                onSelect={(val) => setValue('client_id', Number(val), { shouldValidate: true })}
                placeholder="Buscar cliente por nombre o documento..."
              />
              {errors.client_id && (
                <span className="text-xs text-rose-400">
                  {errors.client_id.message as string}
                </span>
              )}
            </div>

            {/* 2. Plan Select */}
            <div className="space-y-1.5">
              <Select
                label="Plan de Cobertura *"
                options={planOptions}
                error={!!errors.membership_plan_id}
                helperText={errors.membership_plan_id?.message as string}
                value={selectedPlanId ? String(selectedPlanId) : ''}
                onChange={(e) =>
                  setValue('membership_plan_id', Number(e.target.value), {
                    shouldValidate: true,
                  })
                }
                onValueChange={(val) =>
                  setValue('membership_plan_id', Number(val), { shouldValidate: true })
                }
              />
            </div>

            {/* 3. Fechas: Inicio & Vencimiento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Fecha de Inicio <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-[var(--radius-md)] border border-border-medium bg-surface-base px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:border-brand-primary transition-all font-mono"
                  disabled={isSaving}
                  {...register('start_date')}
                />
                {errors.start_date && (
                  <span className="text-xs text-rose-400">
                    {errors.start_date.message as string}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Fecha de Vencimiento
                </label>
                <div className="flex h-10 w-full items-center rounded-[var(--radius-md)] border border-border-subtle bg-surface-raised px-3 text-xs font-mono font-medium text-text-primary">
                  {calculatedEndDate ? (
                    <span className="text-brand-primary">
                      {calculatedEndDate.short} ({selectedPlan?.duration_days} días)
                    </span>
                  ) : (
                    <span className="text-text-muted">Calculada al elegir plan</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Entrenador Asignado */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Entrenador Asignado (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Entrenador de turno..."
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-border-medium bg-surface-base px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:border-brand-primary transition-all"
                disabled={isSaving}
                {...register('trainer_name')}
              />
            </div>

            {/* 5. Descuento Especial */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Descuento Especial ($ COP)
                </label>
                {discount > 0 && selectedPlan && (
                  <span className="text-xs text-brand-primary font-mono font-semibold">
                    Neto: {formatCurrency(planTotal)}
                  </span>
                )}
              </div>
              <NumericInput
                placeholder="0"
                value={discountRaw !== undefined && discountRaw !== 0 ? discountRaw : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  const capped = Math.min(basePrice, Math.max(0, val));
                  setValue('discount', capped, { shouldValidate: true });
                  if (registerPayment && selectedPlan) {
                    const net = Math.max(0, basePrice - capped);
                    setValue('amount_paid', net, { shouldValidate: true });
                  }
                }}
                disabled={isSaving || !selectedPlan}
                leftIcon={<DollarSign size={15} />}
                className="text-xs"
              />
              {discount > 0 && selectedPlan && (
                <p className="text-[11px] text-text-muted leading-tight">
                  Precio base catálogo: <span className="line-through">{formatCurrency(basePrice)}</span> → Aplica descuento a esta suscripción sin alterar el catálogo general.
                </p>
              )}
            </div>

            {/* 6. Sección de Pago y Cobro */}
            <div className="pt-2">
              <div className="p-4 rounded-[var(--radius-xl)] border border-border-subtle bg-surface-base/70 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-surface-base border-border-medium"
                      {...register('register_payment')}
                    />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      Registrar cobro de afiliación
                    </span>
                  </label>
                  {registerPayment && selectedPlan && (
                    <button
                      type="button"
                      onClick={() =>
                        setValue('amount_paid', planTotal, { shouldValidate: true })
                      }
                      className="text-xs text-brand-primary hover:underline font-semibold cursor-pointer"
                    >
                      Pagar Total ({formatCurrency(planTotal)})
                    </button>
                  )}
                </div>

                {registerPayment && (
                  <div className="space-y-3.5 pt-3 border-t border-border-subtle">
                    {/* Payment Method Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        Método de Pago
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((pm) => {
                          const Icon = pm.icon;
                          const isSelected = paymentMethod === pm.value;
                          return (
                            <button
                              key={pm.value}
                              type="button"
                              onClick={() =>
                                setValue('payment_method', pm.value, { shouldValidate: true })
                              }
                              disabled={isSaving}
                              className={cn(
                                'flex flex-col items-center justify-center p-2 rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer text-center',
                                isSelected
                                  ? 'bg-brand-primary/10 border-brand-primary text-text-primary shadow-xs'
                                  : 'bg-surface-base border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-raised'
                              )}
                            >
                              <Icon
                                size={16}
                                className={cn(
                                  'mb-1',
                                  isSelected ? 'text-brand-primary' : 'text-text-muted'
                                )}
                              />
                              <span className="text-xs font-semibold">{pm.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cash Register Closed Alert */}
                    {paymentMethod === 'CASH' && !activeRegister.data && (
                      <div className="p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-200/90 leading-tight">
                          <strong className="font-semibold block text-amber-300">
                            Caja de turno cerrada
                          </strong>
                          Debes abrir una caja antes de recibir pagos en efectivo.
                        </div>
                      </div>
                    )}

                    {/* Paid Amount */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                          Monto Recibido
                        </label>
                        <NumericInput
                          placeholder="0"
                          value={amountPaidRaw !== undefined ? amountPaidRaw : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setValue('amount_paid', val, { shouldValidate: true });
                          }}
                          disabled={isSaving}
                          leftIcon={<DollarSign size={15} />}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                          Referencia / Comprobante
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Nequi #8493"
                          className="flex h-10 w-full rounded-[var(--radius-md)] border border-border-medium bg-surface-base px-3 py-1.5 text-xs text-text-primary focus-visible:outline-none focus-visible:border-brand-primary"
                          disabled={isSaving}
                          {...register('reference')}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen Financiero Dinámico */}
                <div className="p-3.5 bg-surface-raised rounded-[var(--radius-lg)] border border-border-subtle space-y-2 text-xs">
                  <div className="flex justify-between items-center text-text-secondary">
                    <span>Precio Catálogo:</span>
                    <span className="font-mono font-medium text-text-primary">
                      {formatCurrency(basePrice)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400">
                      <span>Descuento Otorgado:</span>
                      <span className="font-mono font-bold">
                        - {formatCurrency(discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-text-secondary">
                    <span>Total a Facturar:</span>
                    <span className="font-mono font-bold text-text-primary">
                      {formatCurrency(planTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-text-secondary">
                    <span>Monto Recibido:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
                    <span className="font-bold text-xs uppercase tracking-wider text-text-primary">
                      Saldo a Crédito (CxC):
                    </span>
                    <span
                      className={cn(
                        'font-mono font-black text-base',
                        pendingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                      )}
                    >
                      {formatCurrency(pendingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Security & Automation Hook */}
            <div className="p-3 rounded-[var(--radius-lg)] bg-surface-raised border border-border-subtle flex items-start gap-2 text-xs text-text-muted">
              <ShieldCheck size={16} className="text-brand-primary shrink-0 mt-0.5" />
              <span>
                Al registrar la membresía se emitirá el recibo digital con validación multi-tenant y se enviará la confirmación por WhatsApp en background.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-3.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] mt-auto bg-surface-panel/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer touch-manipulation"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <ActionGlowButton type="submit" isLoading={isSaving} className="min-h-[42px] text-xs font-bold touch-manipulation">
              {isRenewal ? 'Confirmar Renovación' : 'Registrar Membresía'}
            </ActionGlowButton>
          </div>
        </form>
      </Drawer>

      <PaymentSuccessModal
        isOpen={!!completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        clientName={completedReceipt?.clientName || ''}
        concept={completedReceipt?.planName || 'Mensualidad'}
        amount={completedReceipt ? formatCurrency(completedReceipt.paidAmount) : '$0'}
        receiptNumber={completedReceipt?.receiptNumber}
        onDownloadReceipt={handleDownloadReceipt}
        onWhatsApp={() => {
          if (!completedReceipt) return;
          openWhatsAppModal({
            client: {
              id: selectedClientId || 0,
              full_name: completedReceipt.clientName || 'Cliente',
              phone: completedReceipt.clientPhone,
            },
            eventType: 'PAYMENT_RECEIVED',
            eventLabel: 'Pago Recibido',
            contextData: {
              payment_concept: completedReceipt.planName,
              amount: formatCurrency(completedReceipt.paidAmount),
            },
          });
        }}
      />
      <WhatsAppModalComponent />
    </>
  );
}
