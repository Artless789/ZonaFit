import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { Modal } from '@shared/ui/Modal';
import { NumericInput } from '@shared/ui/NumericInput';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { clientSchema, ClientFormValues } from '@shared/schemas/clientSchema';
import type { Client } from '@shared/types/client';
import { useClients } from '../../hooks/useClients';
import { useMembershipPlans } from '../../hooks/useMembershipPlans';
import { useGymSettings } from '../../hooks/useGymSettings';
import { api } from '../../services/api';
import { 
  User as UserIcon, 
  Upload, 
  X, 
  Sparkles, 
  DollarSign, 
  CheckCircle2, 
  Download 
} from 'lucide-react';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<GenerateMembershipReceiptProps | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawPlans = (Array.isArray(plansQuery.data) ? plansQuery.data : plansQuery.data?.items) || [];
  const activePlans = useMemo(() => rawPlans.filter(p => p.is_active), [rawPlans]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
    },
  });

  const assignMembership = watch('assign_membership');
  const selectedPlanId = watch('membership_plan_id');
  const startDateValue = watch('start_date') || todayStr;
  const discountRaw = watch('discount');
  const registerPayment = watch('register_payment');
  const paymentMethod = watch('payment_method') || 'CASH';
  const amountPaidRaw = watch('amount_paid');

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
  }, [selectedPlanId, setValue]);

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
      setPhotoFile(null);
      setPhotoPreview(null);
      setCompletedReceipt(null);
    }
  }, [isOpen, client, reset, todayStr]);

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
        await updateMutation.mutateAsync({ id: client.id, data });
        if (photoFile) await uploadPhoto(client.id);
        toast({ type: 'success', title: 'Cliente Actualizado', message: 'Datos guardados correctamente.' });
        onClose();
      } else {
        const payload: any = {
          full_name: data.full_name,
          document_type: data.document_type,
          document: data.document,
          phone: data.phone,
          email: data.email || null,
          notes: data.notes || null,
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
        if (photoFile) await uploadPhoto(newClient.id);

        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['memberships'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
        queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
        queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
        queryClient.invalidateQueries({ queryKey: ['accounts_receivables'] });

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

  const planOptions = activePlans.map(p => ({
    value: p.id,
    label: `${p.name} - ${formatCurrency(p.price)} (${p.duration_days} días)`,
  }));

  return (
    <>
      <Drawer 
        isOpen={isOpen} 
        onClose={onClose} 
        title={isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex flex-col gap-5 flex-1 pb-4">
            
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
                disabled={isSaving || isEditing}
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
                rows={3}
                placeholder="Condiciones médicas, observaciones especiales..."
                className={`w-full rounded-md border ${errors.notes ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50`}
                disabled={isSaving}
                {...register('notes')}
              />
            </div>

            {/* SECCIÓN OPCIONAL: ASIGNAR MEMBRESÍA INICIAL AL CREAR */}
            {!isEditing && (
              <div className="pt-2">
                <div className="rounded-xl border border-border-medium bg-bg-surface/40 overflow-hidden">
                  <div 
                    onClick={() => setValue('assign_membership', !assignMembership, { shouldValidate: true })}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-bg-elevated/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!assignMembership}
                        onChange={(e) => setValue('assign_membership', e.target.checked, { shouldValidate: true })}
                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-bg-surface border-border-medium"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
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
                    <div className="p-4 pt-2 border-t border-border-light space-y-4">
                      {/* Selector de Plan */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Plan de Membresía <span className="text-danger">*</span>
                        </label>
                        <Select
                          options={planOptions}
                          value={selectedPlanId ? String(selectedPlanId) : ''}
                          onChange={(e) => {
                            const planId = Number(e.target.value);
                            setValue('membership_plan_id', planId, { shouldValidate: true });
                            const p = activePlans.find(item => item.id === planId);
                            if (p && registerPayment) {
                              const disc = Math.min(Number(p.price), Math.max(0, Number(watch('discount') || 0)));
                              setValue('amount_paid', Math.max(0, Number(p.price) - disc), { shouldValidate: true });
                            }
                          }}
                          disabled={isSaving}
                        />
                      </div>

                      {/* Fechas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Fecha de Inicio
                          </label>
                          <input
                            type="date"
                            className="flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
                            disabled={isSaving}
                            {...register('start_date')}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Vencimiento Calculado
                          </label>
                          <div className="flex h-10 w-full items-center rounded-xl border border-border-light bg-bg-elevated/50 px-3 text-sm font-medium text-text-primary">
                            {calculatedEndDate ? (
                              <span className="text-brand-primary">{calculatedEndDate.short} ({selectedPlan?.duration_days} días)</span>
                            ) : (
                              <span className="text-text-muted">Elige un plan</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Entrenador */}
                      <Input
                        label="Entrenador a Cargo (Opcional)"
                        placeholder="Ej. Carlos G."
                        disabled={isSaving}
                        {...register('trainer_name')}
                      />

                      {/* Descuento Especial */}
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
                              setValue('amount_paid', Math.max(0, basePrice - capped), { shouldValidate: true });
                            }
                          }}
                          disabled={isSaving || !selectedPlan}
                          leftIcon={<DollarSign size={16} />}
                        />
                      </div>

                      {/* Cobro Inicial */}
                      <div className="pt-2 border-t border-border-light space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary bg-bg-surface border-border-medium"
                              {...register('register_payment')}
                            />
                            <span className="text-sm font-semibold text-text-primary">Registrar Pago Inmediato</span>
                          </label>
                          {registerPayment && selectedPlan && (
                            <button
                              type="button"
                              onClick={() => setValue('amount_paid', planTotal, { shouldValidate: true })}
                              className="text-xs text-brand-primary hover:underline font-medium"
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

                            <Input
                              label="Referencia / Comprobante (Opcional)"
                              placeholder="Ej. Transf #1234..."
                              disabled={isSaving}
                              {...register('reference')}
                            />
                          </div>
                        )}

                        {/* Resumen Financiero */}
                        {selectedPlan && (
                          <div className="p-3 bg-bg-elevated/60 rounded-lg border border-border-light space-y-1.5 text-xs">
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
                            <div className="flex justify-between pt-1 border-t border-border-light text-sm">
                              <span className="font-medium text-text-primary">Saldo Pendiente:</span>
                              <span className={`font-bold ${pendingBalance > 0 ? 'text-danger' : 'text-success'}`}>
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

          <div className="pt-4 mt-auto border-t border-border-light flex justify-end gap-3">
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

      {/* Success & Invoice Modal */}
      <Modal
        isOpen={!!completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        title="Membresía Registrada Exitosamente"
      >
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          <div className="h-20 w-20 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-success" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary">¡Cliente y Membresía Creados!</h3>
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
