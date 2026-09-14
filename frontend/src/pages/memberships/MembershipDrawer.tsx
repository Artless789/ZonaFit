import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Modal } from '@shared/ui/Modal';
import { Select } from '@shared/ui/Select';
import { NumericInput } from '@shared/ui/NumericInput';
import { ClientSearchCombobox } from '@shared/ui/ClientSearchCombobox';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { membershipSchema, type MembershipFormValues } from '@shared/schemas/membershipSchema';
import { useMemberships } from '../../hooks/useMemberships';
import { useGymSettings } from '../../hooks/useGymSettings';
import { generateMembershipPaymentReceiptPDF, type GenerateMembershipReceiptProps } from '@shared/utils/pdfGenerator';
import type { Client } from '@shared/types/client';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import { formatCurrency } from '@shared/utils/formatters';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { DollarSign, ShieldCheck, CheckCircle2, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface MembershipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  plans: MembershipPlan[];
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
];

export function MembershipDrawer({ isOpen, onClose, clients, plans }: MembershipDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createMutation } = useMemberships();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  const [completedReceipt, setCompletedReceipt] = useState<GenerateMembershipReceiptProps | null>(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      client_id: 0,
      membership_plan_id: 0,
      trainer_name: '',
      start_date: todayStr,
      discount: 0,
      register_payment: true,
      payment_method: 'CASH',
      amount_paid: 0,
      reference: '',
    },
  });

  const selectedClientId = watch('client_id');
  const selectedPlanId = watch('membership_plan_id');
  const startDateValue = watch('start_date') || todayStr;
  const discountRaw = watch('discount');
  const registerPayment = watch('register_payment');
  const paymentMethod = watch('payment_method') || 'CASH';
  const amountPaidRaw = watch('amount_paid');

  const activeClients = useMemo(() => clients.filter(c => c.is_active), [clients]);
  const activePlans = useMemo(() => plans.filter(p => p.is_active), [plans]);

  const selectedPlan = useMemo(() => {
    return activePlans.find(p => p.id === Number(selectedPlanId)) || null;
  }, [activePlans, selectedPlanId]);

  const selectedClient = useMemo(() => {
    return activeClients.find(c => c.id === Number(selectedClientId)) || null;
  }, [activeClients, selectedClientId]);

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
    if (selectedPlan) {
      if (registerPayment) {
        setValue('amount_paid', planTotal, { shouldValidate: true });
      }
    }
  }, [selectedPlan, registerPayment, setValue]);

  useEffect(() => {
    if (isOpen) {
      reset({
        client_id: 0,
        membership_plan_id: 0,
        trainer_name: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0,
        register_payment: true,
        payment_method: 'CASH',
        amount_paid: 0,
        reference: '',
      });
      setCompletedReceipt(null);
    }
  }, [isOpen, reset]);

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

  const planOptions = activePlans.map(p => ({
    value: p.id,
    label: `${p.name} - ${formatCurrency(p.price)} (${p.duration_days} días)`,
  }));

  const handleDownloadReceipt = async () => {
    if (!completedReceipt) return;
    try {
      await generateMembershipPaymentReceiptPDF(completedReceipt);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: 'No se pudo descargar el comprobante.' });
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

    let created: any = null;
    try {
      const payload = {
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

      created = await createMutation.mutateAsync(payload as any);
    } catch (error: any) {
      const errorDetail =
        error?.response?.data?.detail ||
        error?.response?.data?.error?.message ||
        error?.message ||
        'Error desconocido al registrar la membresía.';
      toast({
        type: 'error',
        title: 'Error al Guardar',
        message: errorDetail,
      });
      return;
    }

    try {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_receivables'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
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
        endDate: calculatedEndDate?.dateObj || (created?.end_date ? new Date(created.end_date) : new Date()),
        basePrice: basePrice,
        discount: discount,
        totalPrice: planTotal,
        paidAmount: paidAmount,
        pendingBalance: pendingBalance,
        paymentMethod: data.payment_method || 'CASH',
        gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
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
        title: 'Membresía Asignada',
        message: pendingBalance > 0
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
        title="Asignar Membresía"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex flex-col gap-5 flex-1 pb-6">
          
          {/* 1. Cliente */}
          <div className="relative z-(--z-dropdown)">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Seleccionar Cliente <span className="text-danger">*</span>
            </label>
            <ClientSearchCombobox
              clients={activeClients}
              selectedClientId={selectedClientId}
              onSelect={(id) => setValue('client_id', id || 0, { shouldValidate: true })}
              placeholder="Buscar cliente por nombre o documento..."
            />
            {errors.client_id && (
              <p className="mt-1 text-xs text-danger">{errors.client_id.message as string}</p>
            )}
          </div>

          {/* 2. Plan */}
          <Select
            label="Seleccionar Plan"
            options={planOptions}
            error={!!errors.membership_plan_id}
            helperText={errors.membership_plan_id?.message as string}
            value={selectedPlanId ? String(selectedPlanId) : ''}
            onChange={(e) => setValue('membership_plan_id', Number(e.target.value), { shouldValidate: true })}
            onValueChange={(val) => setValue('membership_plan_id', Number(val), { shouldValidate: true })}
          />

          {/* 3. Fechas: Inicio & Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Fecha de Inicio <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  className="flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:border-brand-primary transition-all duration-200"
                  disabled={isSaving}
                  {...register('start_date')}
                />
              </div>
              {errors.start_date && (
                <span className="text-xs text-danger">{errors.start_date.message as string}</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Fecha de Vencimiento
              </label>
              <div className="flex h-10 w-full items-center rounded-xl border border-border-light bg-bg-elevated/50 px-3 text-sm font-medium text-text-primary">
                {calculatedEndDate ? (
                  <span className="text-brand-primary">{calculatedEndDate.short} ({selectedPlan?.duration_days} días)</span>
                ) : (
                  <span className="text-text-muted">Calculada al elegir plan</span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Entrenador a Cargo */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Entrenador a Cargo (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Carlos G."
              className="flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-4 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:border-brand-primary transition-all duration-200"
              disabled={isSaving}
              {...register('trainer_name')}
            />
          </div>

          {/* 5. Descuento Especial */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">Descuento Especial ($ COP)</label>
              {discount > 0 && selectedPlan && (
                <span className="text-xs text-brand-primary font-medium">
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
              leftIcon={<DollarSign size={16} />}
            />
            {discount > 0 && selectedPlan && (
              <p className="text-xs text-text-muted">
                Precio catálogo: <span className="line-through">{formatCurrency(basePrice)}</span> → Aplica descuento individual sin alterar el catálogo general.
              </p>
            )}
          </div>

          {/* 6. Sección de Pago */}
          <div className="pt-2">
            <div className="p-4 rounded-xl border border-border-medium bg-bg-surface/40 space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-bg-surface border-border-medium"
                    {...register('register_payment')}
                  />
                  <span className="text-sm font-semibold text-text-primary">Registrar pago</span>
                </label>
                {registerPayment && selectedPlan && (
                  <button
                    type="button"
                    onClick={() => setValue('amount_paid', planTotal, { shouldValidate: true })}
                    className="text-xs text-brand-primary hover:underline font-medium"
                  >
                    Pagar Totalidad ({formatCurrency(planTotal)})
                  </button>
                )}
              </div>

              {registerPayment && (
                <div className="space-y-4 pt-2 border-t border-border-light">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Método de Pago"
                      options={PAYMENT_METHODS}
                      disabled={isSaving}
                      value={paymentMethod}
                      onChange={(e) => setValue('payment_method', e.target.value as any, { shouldValidate: true })}
                      onValueChange={(val) => setValue('payment_method', val as any, { shouldValidate: true })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
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
                        leftIcon={<DollarSign size={16} />}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Referencia o Comprobante (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Transf #1234, comprobante, etc."
                      className="flex h-9 w-full rounded-lg border border-border-medium bg-bg-surface/60 px-3 py-1.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                      disabled={isSaving}
                      {...register('reference')}
                    />
                  </div>
                </div>
              )}

              {/* Resumen Financiero Dinámico */}
              <div className="p-3 bg-bg-elevated/60 rounded-lg border border-border-light space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Precio Base Plan:</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(basePrice)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-brand-primary">
                    <span>Descuento Especial:</span>
                    <span className="font-semibold">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total a Pagar:</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(planTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Pagado:</span>
                  <span className="font-semibold text-success">{formatCurrency(paidAmount)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-border-light text-sm">
                  <span className="font-medium text-text-primary">Saldo Pendiente:</span>
                  <span className={`font-bold ${pendingBalance > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatCurrency(pendingBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-brand-primary/5 p-3.5 rounded-xl border border-brand-primary/10 flex items-start gap-2.5 text-xs text-text-secondary">
            <ShieldCheck size={16} className="text-brand-primary shrink-0 mt-0.5" />
            <p>
              Al registrar el pago se emitirá el recibo digital y se actualizará automáticamente la caja y el estado de WhatsApp.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-auto border-t border-border-light flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <ActionGlowButton type="submit" isLoading={isSaving}>
            Crear Membresía
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>

    {/* Success & Invoice Modal */}
    <Modal
      isOpen={!!completedReceipt}
      onClose={() => setCompletedReceipt(null)}
      title="Venta Registrada Exitosamente"
    >
      <div className="flex flex-col items-center justify-center space-y-6 py-4">
        <div className="h-20 w-20 bg-success/10 rounded-full flex items-center justify-center">
          <CheckCircle2 size={40} className="text-success" />
        </div>
        
        <div className="text-center">
          <h3 className="text-xl font-bold text-text-primary">¡Venta Completada!</h3>
          <p className="text-text-secondary mt-1">
            Se ha generado el comprobante <strong>{completedReceipt?.receiptNumber}</strong>
          </p>
        </div>

        <div className="flex flex-col w-full gap-3 mt-4">
          <ActionGlowButton 
            onClick={handleDownloadReceipt}
            className="w-full flex justify-center py-3"
          >
            <Download className="mr-2" size={18} />
            Descargar Comprobante PDF
          </ActionGlowButton>
          
          <button
            type="button"
            onClick={() => setCompletedReceipt(null)}
            className="w-full py-3 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-elevated border border-border-medium rounded-lg transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    </Modal>
  </>
  );
}

