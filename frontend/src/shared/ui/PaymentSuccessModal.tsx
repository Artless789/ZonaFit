import React from 'react';
import { CheckCircle2, Download, MessageSquare, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  concept: string;
  amount: string;
  receiptNumber?: string;
  onDownloadReceipt?: () => void | Promise<void>;
  onWhatsApp?: () => void;
  isDownloading?: boolean;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  clientName,
  concept,
  amount,
  receiptNumber,
  onDownloadReceipt,
  onWhatsApp,
  isDownloading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pago Registrado Correctamente"
      className="max-w-md"
    >
      <div className="flex flex-col items-center justify-center space-y-5 py-2">
        {/* Glow Success Icon */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-success/20 blur-xl animate-pulse" />
          <div className="relative h-16 w-16 bg-success/15 border border-success/30 rounded-full flex items-center justify-center text-success shadow-lg shadow-success/10">
            <CheckCircle2 size={36} />
          </div>
        </div>

        {/* Title & subtitle */}
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-text-primary">Pago Exitoso</h3>
          {receiptNumber && (
            <p className="text-xs text-text-muted font-mono">
              Comprobante: <span className="text-brand-primary font-semibold">{receiptNumber}</span>
            </p>
          )}
        </div>

        {/* Payment Details Card */}
        <div className="w-full bg-bg-surface border border-border-light rounded-xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between py-1 border-b border-border-light/60">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Cliente:</span>
            <span className="text-sm font-semibold text-text-primary text-right truncate max-w-[200px]">
              {clientName || 'Sin especificar'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border-light/60">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Concepto:</span>
            <span className="text-sm font-medium text-text-secondary text-right truncate max-w-[200px]">
              {concept || 'Mensualidad'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Valor:</span>
            <span className="text-base font-bold text-success font-mono">
              {amount}
            </span>
          </div>
        </div>

        {/* 3 Main Action Buttons */}
        <div className="w-full space-y-2.5 pt-2">
          {onWhatsApp && (
            <Button
              type="button"
              variant="primary"
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30 border border-emerald-400/30"
              onClick={onWhatsApp}
            >
              <MessageSquare size={18} className="text-white" />
              <span>WhatsApp</span>
            </Button>
          )}

          {onDownloadReceipt && (
            <Button
              type="button"
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-bg-elevated hover:bg-bg-elevated/80 border border-border-medium text-text-primary"
              onClick={onDownloadReceipt}
              disabled={isDownloading}
            >
              <Download size={17} className="text-text-secondary" />
              <span>{isDownloading ? 'Generando PDF...' : 'Descargar recibo'}</span>
            </Button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            <span>Continuar</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
