import { useEffect, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { Modal } from '@shared/ui/Modal';
import { NumericInput } from '@shared/ui/NumericInput';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { clientSchema, ClientFormValues } from '@shared/schemas/clientSchema';
import type { Client, ClientCreate } from '@shared/types/client';
import { useClients } from '../../hooks/useClients';
import { useMembershipPlans } from '../../hooks/useMembershipPlans';
import { useGymSettings } from '../../hooks/useGymSettings';
import { clientService } from '../../services/clientService';
import {
  Sparkles,
  DollarSign,
  MessageSquare,
  Users
} from 'lucide-react';
import { Button } from '@shared/ui/Button';
import { PaymentSuccessModal } from '@shared/ui/PaymentSuccessModal';
import { useWhatsAppWeb } from '../../hooks/useWhatsAppWeb';
import { whatsappGroupService } from '../../services/whatsappGroupService';
import type { WhatsAppGroup } from '@shared/types/whatsappGroup';
import { ClientPhotoUploader } from './ClientPhotoUploader';
import { formatCurrency } from '@shared/utils/formatters';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  generateMembershipPaymentReceiptPDF,
  type GenerateMembershipReceiptProps
} from '@shared/utils/pdfGenerator';
import { useQueryClient } from '@tanstack/react-query';

interface ClientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
];

export function ClientDrawer({ isOpen, onClose, client }: ClientDrawerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createMutation, updateMutation } = useClients();
  const { query: plansQuery } = useMembershipPlans();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  const isEditing = !!client;
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<GenerateMembershipReceiptProps | null>(null);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroup[]>([]);
  const [createdClientId, setCreatedClientId] = useState<number | null>(null);
  const [groupInviteClient, setGroupInviteClient] = useState<{
    id: number;
    full_name: string;
    phone: string;
    group_name: string;
  } | null>(null);
  const [pendingGroupInvitation, setPendingGroupInvitation] = useState<{
    id: number;
    full_name: string;
    phone: string;
    group_name: string;
  } | null>(null);

  const activePlans = useMemo(() => {
    const rawPlans = (Array.isArray(plansQuery.data) ? plansQuery.data : plansQuery.data?.items) || [];
    return rawPlans.filter(p => p.is_active);
  }, [plansQuery.data]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
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
      assign_membership: false,
      membership_plan_id: 0,
      trainer_name: '',
      start_date: todayStr,
      discount: 0,
      register_payment: true,
      payment_method: 'CASH',
      amount_paid: 0,
      reference: '',
      whatsapp_opt_in: false,
      whatsapp_group_id: null,
    },
  });

  useEffect(() => {
    if (isOpen) {
      whatsappGroupService.getAll(true)
        .then((groups) => {
          setAvailableGroups(Array.isArray(groups) ? groups : []);
        })
        .catch(() => {
          setAvailableGroups([]);
        });
    }
  }, [isOpen]);

  const assignMembership = useWatch({ control, name: 'assign_membership' });
  const selectedPlanId = useWatch({ control, name: 'membership_plan_id' });
  const startDateWatched = useWatch({ control, name: 'start_date' });
  const startDateValue = startDateWatched || todayStr;
  const discountRaw = useWatch({ control, name: 'discount' });
  const registerPayment = useWatch({ control, name: 'register_payment' });
  const paymentMethodWatched = useWatch({ control, name: 'payment_method' });
  const paymentMethod = paymentMethodWatched || 'CASH';
  const amountPaidRaw = useWatch({ control, name: 'amount_paid' });
  const whatsappGroupIdWatched = useWatch({ control, name: 'whatsapp_group_id' });

  const selectedPlan = useMemo(() => {
    return activePlans.find(p => p.id === Number(selectedPlanId)) || null;
  }, [activePlans, selectedPlanId]);

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

  const paidAmount = registerPayment
    ? typeof amountPaidRaw === 'number'
      ? amountPaidRaw
      : parseFloat(String(amountPaidRaw || '').replace(/[^0-9.-]+/g, '')) || 0
    : 0;
  const pendingBalance = Math.max(0, planTotal - paidAmount);

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

  useEffect(() => {
    if (selectedPlan && registerPayment) {
      setValue('amount_paid', planTotal, { shouldValidate: true });
    }
  }, [selectedPlan, registerPayment, planTotal, setValue]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setPhotoFile(null);
      setPhotoRemoved(false);
      setCompletedReceipt(null);
    }
  }

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
          whatsapp_opt_in: client.whatsapp_opt_in ?? false,
          whatsapp_group_id: client.whatsapp_group_id ?? null,
          assign_membership: false,
          membership_plan_id: 0,
          trainer_name: '',
          start_date: todayStr,
          discount: 0,
          register_payment: true,
          payment_method: 'CASH',
          amount_paid: 0,
          reference: '',
        });
      } else {
        reset({
          document_type: 'CC',
          full_name: '',
          document: '',
          phone: '',
          email: '',
          notes: '',
          whatsapp_opt_in: false,
          whatsapp_group_id: null,
          assign_membership: false,
          membership_plan_id: 0,
          trainer_name: '',
          start_date: todayStr,
          discount: 0,
          register_payment: true,
          payment_method: 'CASH',
          amount_paid: 0,
          reference: '',
        });
      }
    }
  }, [isOpen, client, reset, todayStr]);

  const handleDownloadReceipt = async () => {
    if (!completedReceipt) return;
    try {
      await generateMembershipPaymentReceiptPDF(completedReceipt);
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo descargar el comprobante.' });
    }
  };

  const onSubmit = async (data: ClientFormValues) => {
    try {
      setIsUploading(true);
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: client.id,
          data: {
            ...data,
            whatsapp_opt_in: !!data.whatsapp_opt_in,
            whatsapp_group_id: data.whatsapp_group_id ? Number(data.whatsapp_group_id) : null,
          }
        });
        if (photoFile) {
          await clientService.uploadPhoto(client.id, photoFile);
        } else if (photoRemoved) {
          await clientService.deletePhoto(client.id);
        }
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['client360'] });
        toast({ type: 'success', title: 'Cliente Actualizado', message: 'Datos guardados correctamente.' });
        onClose();
      } else {
        const payload: ClientCreate = {
          full_name: data.full_name,
          document_type: data.document_type,
          document: data.document,
          phone: data.phone,
          email: data.email || null,
          notes: data.notes || null,
          whatsapp_opt_in: !!data.whatsapp_opt_in,
          whatsapp_group_id: data.whatsapp_group_id ? Number(data.whatsapp_group_id) : null,
        };

        if (data.assign_membership && data.membership_plan_id) {
          if (data.register_payment && paidAmount > planTotal) {
            toast({
              type: 'error',
              title: 'Monto Excedido',
              message: `El monto pagado (${formatCurrency(paidAmount)}) no puede superar el costo del plan (${formatCurrency(planTotal)}).`,
            });
            setIsUploading(false);
            return;
          }

          payload.initial_membership = {
            membership_plan_id: data.membership_plan_id,
            trainer_name: data.trainer_name || undefined,
            start_date: data.start_date ? new Date(`${data.start_date}T00:00:00Z`).toISOString() : undefined,
            discount: discount,
            register_payment: !!data.register_payment,
            payment_method: data.register_payment ? data.payment_method : undefined,
            amount_paid: data.register_payment ? paidAmount : 0,
            reference: data.register_payment && data.reference ? data.reference : undefined,
          };
        }

        const newClient = await createMutation.mutateAsync(payload);
        setCreatedClientId(newClient.id);
        const hasGroup = !!newClient.whatsapp_group_id;
        const selectedGroup = hasGroup && Array.isArray(availableGroups) ? availableGroups.find(g => g.id === newClient.whatsapp_group_id) : null;

        if (photoFile) {
          await clientService.uploadPhoto(newClient.id, photoFile);
        }

        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['client360'] });
        queryClient.invalidateQueries({ queryKey: ['memberships'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
        queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
        queryClient.invalidateQueries({ queryKey: ['accounts-receivables'] });

        if (data.assign_membership && data.register_payment && paidAmount > 0 && newClient?.initial_membership) {
          const receiptData: GenerateMembershipReceiptProps = {
            receiptNumber: `REC-MEM-${newClient.initial_membership.id || 'NUEVO'}`,
            paymentDate: new Date(),
            clientName: data.full_name,
            clientDocument: data.document,
            clientPhone: data.phone,
            planName: selectedPlan?.name || 'Membresía',
            durationDays: selectedPlan?.duration_days,
            startDate: data.start_date || todayStr,
            endDate: calculatedEndDate?.dateObj || (newClient.initial_membership.end_date ? new Date(newClient.initial_membership.end_date) : new Date()),
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
          if (hasGroup && selectedGroup && newClient.phone) {
            setPendingGroupInvitation({
              id: newClient.id,
              full_name: newClient.full_name,
              phone: newClient.phone,
              group_name: selectedGroup.name,
            });
          }
          onClose();
        } else if (hasGroup && selectedGroup && newClient.phone) {
          setGroupInviteClient({
            id: newClient.id,
            full_name: newClient.full_name,
            phone: newClient.phone,
            group_name: selectedGroup.name,
          });
          onClose();
        } else {
          toast({
            type: 'success',
            title: 'Cliente Creado',
            message: data.assign_membership
              ? 'Cliente y membresía registrados exitosamente.'
              : 'El cliente fue registrado exitosamente.'
          });
          onClose();
        }
      }
    } catch (error: unknown) {
      let errorDetail = 'No se pudo guardar la información del cliente.';
      if (axios.isAxiosError(error)) {
        errorDetail = error.response?.data?.detail || errorDetail;
      } else if (error instanceof Error) {
        errorDetail = error.message;
      }
      toast({
        type: 'error',
        title: 'Error',
        message: errorDetail,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading;

  const planOptions = activePlans.map(p => ({
    value: p.id,
    label: `${p.name} - ${formatCurrency(p.price)} (${p.duration_days} días)`,
  }));

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Editar Socio' : 'Nuevo Socio'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex flex-col gap-5 flex-1 pb-4">

            {/* Photo Upload Section */}
            <ClientPhotoUploader
              currentPhotoUrl={client?.photo_url}
              onPhotoSelected={(file) => {
                setPhotoFile(file);
                if (file) setPhotoRemoved(false);
              }}
              onPhotoRemoved={() => {
                setPhotoFile(null);
                setPhotoRemoved(true);
              }}
              disabled={isSaving}
            />

            {/* Identidad */}
            <div className="p-4 rounded-2xl bg-surface-panel/80 border border-border-subtle space-y-4 shadow-subtle">
              <span className="text-xs font-mono uppercase tracking-wider text-text-muted block">
                Identidad del Socio
              </span>

              <Input
                label="Nombre Completo"
                placeholder="Ej. Juan Pérez"
                error={!!errors.full_name}
                helperText={errors.full_name?.message}
                disabled={isSaving}
                className="rounded-xl border-border-medium bg-surface-base"
                {...register('full_name')}
              />

              <div className="grid grid-cols-3 gap-3">
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
                  className="col-span-2 rounded-xl border-border-medium bg-surface-base"
                  placeholder="Ej. 1020304050"
                  error={!!errors.document}
                  helperText={errors.document?.message}
                  disabled={isSaving || isEditing}
                  {...register('document')}
                />
              </div>

              <Input
                label="Teléfono Móvil"
                placeholder="Ej. 3001234567"
                error={!!errors.phone}
                helperText={errors.phone?.message}
                disabled={isSaving}
                className="rounded-xl border-border-medium bg-surface-base font-mono"
                {...register('phone')}
              />

              <Input
                label="Correo Electrónico (Opcional)"
                type="email"
                placeholder="ejemplo@correo.com"
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={isSaving}
                className="rounded-xl border-border-medium bg-surface-base"
                {...register('email')}
              />
            </div>

            {/* SECCIÓN COMUNICACIÓN & GRUPOS DE WHATSAPP */}
            <div className="p-4 rounded-2xl border border-border-subtle bg-surface-panel/80 space-y-3.5 shadow-subtle">
              <div className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <MessageSquare size={13} className="text-emerald-400" />
                <span>COMUNICACIÓN DIRECTA & WHATSAPP</span>
              </div>

              <label className="flex items-center gap-3 cursor-pointer text-sm text-text-primary select-none p-2.5 rounded-xl bg-surface-base border border-border-subtle hover:bg-surface-raised transition-colors">
                <input
                  type="checkbox"
                  {...register('whatsapp_opt_in')}
                  disabled={isSaving}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-surface-base border-border-medium cursor-pointer"
                />
                <span className="text-xs font-medium text-text-primary">
                  Desea recibir comunicaciones oficiales por WhatsApp
                </span>
              </label>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                  <Users size={12} className="text-brand-primary" />
                  <span>GRUPO DE WHATSAPP ASOCIADO (OPCIONAL)</span>
                </label>
                <select
                  value={whatsappGroupIdWatched || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setValue('whatsapp_group_id', val, { shouldValidate: true });
                  }}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-border-medium bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
                >
                  <option value="">No agregar a ningún grupo</option>
                  {Array.isArray(availableGroups) && availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted">
                  Asigna un grupo para preparar invitaciones automáticas con el enlace de WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1 p-4 rounded-2xl border border-border-subtle bg-surface-panel/80 shadow-subtle">
              <label className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">
                Notas & Observaciones (Opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Condiciones médicas, observaciones de entrenamiento, notas del socio..."
                className={`w-full rounded-xl border ${errors.notes ? 'border-red-500' : 'border-border-medium'} bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary transition-all disabled:opacity-50`}
                disabled={isSaving}
                {...register('notes')}
              />
            </div>

            {/* SECCIÓN OPCIONAL: ASIGNAR MEMBRESÍA INICIAL AL CREAR */}
            {!isEditing && (
              <div className="pt-1">
                <div className="rounded-2xl border border-border-subtle bg-surface-panel/80 overflow-hidden shadow-subtle">
                  <div
                    onClick={() => setValue('assign_membership', !assignMembership, { shouldValidate: true })}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-raised transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!assignMembership}
                        onChange={(e) => setValue('assign_membership', e.target.checked, { shouldValidate: true })}
                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-surface-base border-border-medium cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <span className="text-sm font-bold text-text-primary flex items-center gap-1.5 tracking-tight">
                          <Sparkles size={15} className="text-brand-primary" />
                          Asignar Membresía Inicial (Opcional)
                        </span>
                        <p className="text-xs text-text-muted">
                          Vincula un plan y registra el cobro de inmediato sin pasos adicionales.
                        </p>
                      </div>
                    </div>
                  </div>

                  {assignMembership && (
                    <div className="p-4 pt-2 border-t border-border-subtle space-y-4 bg-surface-base/50">
                      {/* Selector de Plan */}
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                          Plan de Membresía <span className="text-red-400">*</span>
                        </label>
                        <Select
                          options={planOptions}
                          value={selectedPlanId ? String(selectedPlanId) : ''}
                          onChange={(e) => {
                            const planId = Number(e.target.value);
                            setValue('membership_plan_id', planId, { shouldValidate: true });
                            const p = activePlans.find(item => item.id === planId);
                            if (p && registerPayment) {
                              const disc = Math.min(Number(p.price), Math.max(0, Number(discountRaw || 0)));
                              setValue('amount_paid', Math.max(0, Number(p.price) - disc), { shouldValidate: true });
                            }
                          }}
                          disabled={isSaving}
                        />
                      </div>

                      {/* Fechas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                            Fecha de Inicio
                          </label>
                          <input
                            type="date"
                            className="flex h-10 w-full rounded-xl border border-border-medium bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary font-mono"
                            disabled={isSaving}
                            {...register('start_date')}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                            Vencimiento Calculado
                          </label>
                          <div className="flex h-10 w-full items-center rounded-xl border border-border-subtle bg-surface-raised px-3 text-sm font-medium font-mono text-text-primary">
                            {calculatedEndDate ? (
                              <span className="text-brand-primary font-semibold">{calculatedEndDate.short} ({selectedPlan?.duration_days} días)</span>
                            ) : (
                              <span className="text-text-muted">Elige un plan</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Entrenador */}
                      <Input
                        label="Entrenador Responsable (Opcional)"
                        placeholder="Ej. Carlos Gómez"
                        disabled={isSaving}
                        className="rounded-xl border-border-medium bg-surface-base"
                        {...register('trainer_name')}
                      />

                      {/* Descuento Especial */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                            Descuento Especial ($ COP)
                          </label>
                          {discount > 0 && selectedPlan && (
                            <span className="text-xs text-brand-primary font-mono font-medium">
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
                              setValue('amount_paid', Math.max(0, basePrice - capped), { shouldValidate: true });
                            }
                          }}
                          disabled={isSaving || !selectedPlan}
                          leftIcon={<DollarSign size={16} />}
                        />
                      </div>

                      {/* Cobro Inicial */}
                      <div className="pt-2 border-t border-border-subtle space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-surface-base border-border-medium cursor-pointer"
                              {...register('register_payment')}
                            />
                            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                              Registrar Pago Inmediato
                            </span>
                          </label>
                          {registerPayment && selectedPlan && (
                            <button
                              type="button"
                              onClick={() => setValue('amount_paid', planTotal, { shouldValidate: true })}
                              className="text-xs text-brand-primary hover:underline font-mono font-semibold"
                            >
                              Pagar Total ({formatCurrency(planTotal)})
                            </button>
                          )}
                        </div>

                        {registerPayment && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Select
                                label="Método de Pago"
                                options={PAYMENT_METHODS}
                                disabled={isSaving}
                                value={paymentMethod}
                                onChange={(e) => setValue('payment_method', e.target.value, { shouldValidate: true })}
                              />
                              <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
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

                            <Input
                              label="Referencia / Comprobante (Opcional)"
                              placeholder="Ej. Transf #1234..."
                              disabled={isSaving}
                              className="rounded-xl border-border-medium bg-surface-base font-mono"
                              {...register('reference')}
                            />
                          </div>
                        )}

                        {/* Resumen Financiero */}
                        {selectedPlan && (
                          <div className="p-3.5 bg-surface-base rounded-xl border border-border-subtle space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Precio Base Plan:</span>
                              <span className="font-semibold text-text-primary">{formatCurrency(basePrice)}</span>
                            </div>
                            {discount > 0 && (
                              <div className="flex justify-between text-brand-primary">
                                <span>Descuento Especial:</span>
                                <span className="font-semibold">-{formatCurrency(discount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-text-muted">Total a Pagar:</span>
                              <span className="font-bold text-text-primary">{formatCurrency(planTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Total Pagado:</span>
                              <span className="font-bold text-emerald-400">{formatCurrency(paidAmount)}</span>
                            </div>
                            <div className="flex justify-between pt-1.5 border-t border-border-subtle text-sm">
                              <span className="font-medium text-text-primary">Saldo Pendiente:</span>
                              <span className={`font-bold ${pendingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {formatCurrency(pendingBalance)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 mt-auto border-t border-border-subtle flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <ActionGlowButton
              type="submit"
              isLoading={isSaving}
              disabled={!isDirty && !photoFile && isEditing}
              className="rounded-xl text-xs font-semibold"
            >
              {isEditing ? 'Guardar Cambios' : 'Registrar Socio'}
            </ActionGlowButton>
          </div>
        </form>
      </Drawer>

      {/* Success Payment & Receipt Modal */}
      <PaymentSuccessModal
        isOpen={!!completedReceipt}
        onClose={() => {
          setCompletedReceipt(null);
          if (pendingGroupInvitation) {
            setGroupInviteClient(pendingGroupInvitation);
            setPendingGroupInvitation(null);
          }
        }}
        clientName={completedReceipt?.clientName || ''}
        concept={completedReceipt?.planName || 'Mensualidad'}
        amount={completedReceipt ? formatCurrency(completedReceipt.paidAmount) : '$0'}
        receiptNumber={completedReceipt?.receiptNumber}
        onDownloadReceipt={handleDownloadReceipt}
        onWhatsApp={() => {
          if (!completedReceipt) return;
          openWhatsAppModal({
            client: {
              id: createdClientId || 0,
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

      {/* Invitación Opcional a Grupo de WhatsApp */}
      <Modal
        isOpen={!!groupInviteClient}
        onClose={() => setGroupInviteClient(null)}
        title="Cliente Registrado Correctamente"
        className="max-w-md"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-2 text-center">
          <div className="h-16 w-16 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-900/20">
            <Users size={32} />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-text-primary">Invitación a Grupo</h4>
            <p className="text-xs text-text-muted">
              Grupo asignado: <strong className="text-emerald-400">{groupInviteClient?.group_name}</strong>
            </p>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface border border-border-light rounded-xl p-3">
            El cliente fue guardado. ¿Deseas preparar el mensaje oficial de bienvenida por WhatsApp con el enlace de invitación al grupo?
          </p>
          <div className="w-full space-y-2 pt-2">
            <Button
              type="button"
              variant="primary"
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30"
              onClick={() => {
                if (!groupInviteClient) return;
                const clientObj = {
                  id: groupInviteClient.id,
                  full_name: groupInviteClient.full_name,
                  phone: groupInviteClient.phone,
                };
                setGroupInviteClient(null);
                openWhatsAppModal({
                  client: clientObj,
                  eventType: 'GROUP_INVITATION',
                  eventLabel: 'Invitación a grupo',
                });
              }}
            >
              <MessageSquare size={16} />
              <span>Invitar al grupo</span>
            </Button>
            <button
              type="button"
              onClick={() => setGroupInviteClient(null)}
              className="w-full py-2.5 text-xs text-text-muted hover:text-text-primary transition-colors font-medium"
            >
              Continuar sin invitar
            </button>
          </div>
        </div>
      </Modal>

      <WhatsAppModalComponent />
    </>
  );
}
