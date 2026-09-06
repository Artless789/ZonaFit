import { Drawer } from '@shared/ui/Drawer';
import { Badge } from '@shared/ui/Badge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { Download, AlertCircle, ShoppingBag } from 'lucide-react';
import { useInvoiceDetails } from '../../hooks/useInvoices';
import { useGymSettings } from '../../hooks/useGymSettings';
import { generateReceiptPDF } from '@shared/utils/pdfGenerator';
import type { Invoice } from '@shared/types/invoice';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@shared/utils/formatters';

interface InvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  clientName?: string;
  clientDocument?: string;
}

export function InvoiceDrawer({ isOpen, onClose, invoice, clientName, clientDocument }: InvoiceDrawerProps) {
  const { data: details = [], isLoading, error } = useInvoiceDetails(invoice?.id || 0);
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  const formatPrice = formatCurrency;
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, hh:mm a", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="warning">Borrador</Badge>;
      case 'ISSUED': return <Badge variant="success">Emitido</Badge>;
      case 'CANCELLED': return <Badge variant="neutral">Cancelado</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const handleDownload = async () => {
    if (!invoice || !details.length) return;
    try {
      await generateReceiptPDF({
        invoice,
        details,
        clientName,
        clientDocument,
        gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
        gymNit: gymSettings?.tax_id,
        gymPhone: gymSettings?.official_phone,
        gymAddress: gymSettings?.physical_address,
        gymCity: gymSettings?.city,
        paymentMethod: invoice.payment_method,
        receiptFooterNotes: gymSettings?.receipt_footer_notes,
      });
    } catch (err) {
      console.error('Error generating PDF receipt:', err);
    }
  };

  if (!invoice) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del Comprobante"
    >
      <div className="space-y-6">
        
        {/* Main Info */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 space-y-4">
          <div className="flex justify-between items-start border-b border-border-light pb-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">{invoice.invoice_number}</h3>
              <p className="text-sm text-text-muted">{formatDate(invoice.created_at)}</p>
            </div>
            {getStatusBadge(invoice.status)}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-text-muted mb-1">Cliente</span>
              <span className="font-semibold text-text-primary">{clientName || 'Consumidor Final'}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Documento</span>
              <span className="font-semibold text-text-primary">{clientDocument || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Venta Asociada</span>
              <span className="font-semibold text-text-primary">#{invoice.sale_id}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Método de Pago</span>
              <span className="font-semibold text-text-primary">{invoice.payment_method || 'CASH'}</span>
            </div>
          </div>
          
          <div className="pt-2">
            <ActionGlowButton 
              onClick={handleDownload} 
              className="w-full"
              disabled={isLoading || details.length === 0}
            >
              <Download className="mr-2" size={18} />
              Descargar Comprobante PDF
            </ActionGlowButton>
          </div>
        </div>

        {/* Invoice Details (Products) */}
        <div className="space-y-3">
          <h4 className="text-md font-bold text-text-primary flex items-center gap-2 px-1">
            <ShoppingBag size={18} className="text-text-muted" />
            DETALLE DE PRODUCTOS
          </h4>
          
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : error ? (
            <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 bg-danger/5 border-danger/20 flex flex-col items-center justify-center py-6 text-center">
               <AlertCircle className="text-danger opacity-80 mb-2" size={24} />
               <p className="text-danger text-sm">Error al cargar productos.</p>
            </div>
          ) : details.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 flex flex-col items-center justify-center py-8 text-center text-text-muted border-dashed">
              <ShoppingBag size={32} className="opacity-20 mb-2" />
              <p className="text-sm">No hay productos en este comprobante.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {details.map(item => (
                <div key={item.id} className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-3 flex justify-between items-center group hover:bg-bg-elevated transition-colors">
                  <div>
                    <div className="font-semibold text-text-primary text-sm">
                      {item.product_name || `Producto #${item.product_id}`}
                    </div>
                    <div className="text-xs text-text-muted flex gap-2">
                      <span>Cant: {item.quantity}</span>
                      <span>•</span>
                      <span>{formatPrice(item.unit_price)} c/u</span>
                    </div>
                  </div>
                  <div className="font-bold text-text-primary">
                    {formatPrice(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 space-y-2 bg-bg-surface border border-border-medium">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Subtotal:</span>
            <span>{formatPrice(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Descuento:</span>
              <span>-{formatPrice(invoice.discount)}</span>
            </div>
          )}
          {invoice.tax > 0 && (
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Impuestos:</span>
              <span>{formatPrice(invoice.tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-text-primary pt-2 border-t border-border-light">
            <span>TOTAL:</span>
            <span>{formatPrice(invoice.total)}</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
