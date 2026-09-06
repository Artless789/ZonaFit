import { useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import { NumericInput } from '@shared/ui/NumericInput';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { DollarSign } from 'lucide-react';
import { useToast } from '@shared/ui/Toast';
import { useAccountsReceivables } from '../../hooks/useAccountsReceivables';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { formatCurrency } from '@shared/utils/formatters';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ar: AccountsReceivable | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' }
];

export function PaymentModal({ isOpen, onClose, ar }: PaymentModalProps) {
  const { toast } = useToast();
  const { registerPaymentMutation } = useAccountsReceivables();
  
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  const formatPrice = formatCurrency;
  
  if (!ar) return null;

  const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0 : 0;
  const newBalance = Math.max(0, ar.balance_due - amount);
  
  const handleConfirm = async () => {
    if (amount <= 0) {
      toast({ type: 'error', title: 'Monto Inválido', message: 'El abono debe ser mayor a 0.' });
      return;
    }
    if (amount > ar.balance_due) {
      toast({ type: 'error', title: 'Abono Inválido', message: 'El abono no puede superar el saldo pendiente.' });
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
      toast({ type: 'success', title: 'Abono Registrado', message: 'Abono registrado correctamente.' });
      setAmountStr('');
      setPaymentMethod('CASH');
      onClose();
    } catch (error: any) {
      toast({ type: 'error', title: 'Error al registrar', message: error?.response?.data?.detail || 'No pudimos registrar el abono. Inténtalo nuevamente.' });
    }
  };

  const isSaving = registerPaymentMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSaving && onClose()}
      title="Registrar Abono"
    >
      <div className="space-y-4">
        <div className="bg-bg-page border border-border-medium rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Saldo actual:</span>
            <span className="font-bold text-text-primary">{formatPrice(ar.balance_due)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Nuevo saldo después del abono:</span>
            <span className="font-bold text-brand-primary">{formatPrice(newBalance)}</span>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <NumericInput 
            label="Monto del Abono"
            placeholder="0"
            value={amountStr}
            leftIcon={<DollarSign size={16} />}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={isSaving}
            min="0"
            max={ar.balance_due}
          />
          <Select
            label="Método de Pago"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={PAYMENT_METHODS}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-light">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <ActionGlowButton
            onClick={handleConfirm}
            disabled={isSaving || amount <= 0 || amount > ar.balance_due}
            isLoading={isSaving}
          >
            Registrar Abono
          </ActionGlowButton>
        </div>
      </div>
    </Modal>
  );
}
