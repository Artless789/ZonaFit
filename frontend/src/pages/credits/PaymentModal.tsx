import { useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import { NumericInput } from '@shared/ui/NumericInput';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { DollarSign, AlertTriangle, User, Receipt, Sparkles } from 'lucide-react';
import { useToast } from '@shared/ui/Toast';
import { useAccountsReceivables } from '../../hooks/useAccountsReceivables';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { formatCurrency } from '@shared/utils/formatters';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ar: AccountsReceivable | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo (Caja)' },
  { value: 'TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'CARD', label: 'Tarjeta Débito / Crédito' }
];

export function PaymentModal({ isOpen, onClose, ar }: PaymentModalProps) {
  const { toast } = useToast();
  const { registerPaymentMutation } = useAccountsReceivables();
  const { activeRegister } = useCashRegisters();

  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const formatPrice = formatCurrency;

  if (!ar) return null;

  const isCashOpen = !!activeRegister.data;
  const isCashSelected = paymentMethod === 'CASH';
  const hasCashConflict = isCashSelected && !isCashOpen;

  const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0 : 0;
  const newBalance = Math.max(0, ar.balance_due - amount);

  const handleConfirm = async () => {
    if (amount <= 0) {
      toast({ type: 'error', title: 'Monto Inválido', message: 'El abono debe ser mayor a 0.' });
      return;
    }
    if (amount > ar.balance_due) {
      toast({ type: 'error', title: 'Abono Excedido', message: 'El abono no puede ser superior al saldo pendiente.' });
      return;
    }
    if (hasCashConflict) {
      toast({
        type: 'error',
        title: 'Caja Cerrada',
        message: 'No se puede registrar abono en efectivo sin un turno de caja abierto.'
      });
      return;
    }
    if (!paymentMethod) {
      toast({ type: 'error', title: 'Método Requerido', message: 'Selecciona un método de pago.' });
      return;
    }

    try {
      await registerPaymentMutation.mutateAsync({
        id: ar.id,
        data: {
          amount,
          payment_method: paymentMethod
        }
      });
      toast({ type: 'success', title: 'Abono Registrado', message: 'El pago ha sido registrado y el saldo actualizado.' });
      setAmountStr('');
      setPaymentMethod('CASH');
      onClose();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No pudimos registrar el abono. Inténtalo nuevamente.';
      toast({ type: 'error', title: 'Error al registrar', message });
    }
  };

  const isSaving = registerPaymentMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSaving && onClose()}
      title="Registrar Abono a Crédito"
    >
      <div className="space-y-4 font-sans text-sm">
        {/* Context Header Card */}
        <div className="bg-surface-base border border-border-subtle rounded-xl p-3.5 space-y-2.5 font-mono">
          <div className="flex justify-between items-center text-xs pb-2 border-b border-border-subtle">
            <span className="text-text-muted flex items-center gap-1.5 font-sans">
              <User size={13} className="text-brand-primary" />
              <span>Cliente:</span>
            </span>
            <span className="font-bold text-text-primary">
              {ar.client?.full_name || ar.client_name || `Cliente #${ar.client_id}`}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs pb-2 border-b border-border-subtle">
            <span className="text-text-muted flex items-center gap-1.5 font-sans">
              <Receipt size={13} className="text-text-muted" />
              <span>Referencia Venta:</span>
            </span>
            <span className="font-bold text-text-secondary">#{ar.sale_id}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-text-muted font-sans">Saldo Actual Pendiente:</span>
            <span className="font-black text-rose-400 text-sm">{formatPrice(ar.balance_due)}</span>
          </div>

          <div className="flex justify-between items-center text-xs pt-1 border-t border-border-subtle">
            <span className="text-text-muted font-sans">Nuevo Saldo Tras Abono:</span>
            <span className={`font-black text-sm ${newBalance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatPrice(newBalance)}
            </span>
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
                Monto a Abonar ($)
              </label>
              {/* Presets */}
              <button
                type="button"
                onClick={() => setAmountStr(ar.balance_due.toString())}
                className="text-[11px] font-mono text-brand-primary hover:underline cursor-pointer"
              >
                Pagar Total ({formatPrice(ar.balance_due)})
              </button>
            </div>
            <NumericInput
              placeholder="0"
              value={amountStr}
              leftIcon={<DollarSign size={15} />}
              onChange={(e) => setAmountStr(e.target.value)}
              disabled={isSaving}
              min="0"
              max={ar.balance_due}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono mb-1">
              Método de Pago
            </label>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHODS}
              disabled={isSaving}
            />
          </div>

          {/* Caja Cerrada Warning Safeguard */}
          {hasCashConflict && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in duration-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">Turno de caja cerrado</p>
                <p className="mt-0.5 text-text-muted text-[11px] leading-relaxed">
                  Para registrar un abono en efectivo es obligatorio tener un turno de caja abierto en el sistema.
                  Abre la caja en el módulo de <strong className="text-text-primary">Caja</strong> o selecciona <strong className="text-text-primary">Transferencia</strong> / <strong className="text-text-primary">Tarjeta</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <ActionGlowButton
            onClick={handleConfirm}
            disabled={isSaving || amount <= 0 || amount > ar.balance_due || hasCashConflict}
            isLoading={isSaving}
            className="text-xs font-bold py-2"
          >
            <Sparkles size={14} />
            <span>Confirmar Abono</span>
          </ActionGlowButton>
        </div>
      </div>
    </Modal>
  );
}
