import { Drawer } from '../../components/shared/Drawer';
import { GlassCard } from '../../components/shared/GlassCard';
import { Badge } from '../../components/shared/Badge';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { Skeleton } from '../../components/shared/Skeleton';
import { Download, AlertCircle, ShoppingBag } from 'lucide-react';
import { useInvoiceDetails } from '../../hooks/useInvoices';
import { generateReceiptPDF } from '../../utils/pdfGenerator';
import type { Invoice } from '../../types/invoice';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  clientName?: string;
  clientDocument?: string;
}

export function InvoiceDrawer({ isOpen, onClose, invoice, clientName, clientDocument }: InvoiceDrawerProps) {
  const { data: details = [], isLoading, error } = useInvoiceDetails(invoice?.id || 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
  };
  
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

  const handleDownload = () => {
    if (!invoice || !details.length) return;
    generateReceiptPDF({
      invoice,
      details,
      clientName,
      clientDocument,
    });
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
        <GlassCard className="space-y-4">
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
        </GlassCard>

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
            <GlassCard className="bg-danger/5 border-danger/20 flex flex-col items-center justify-center py-6 text-center">
               <AlertCircle className="text-danger opacity-80 mb-2" size={24} />
               <p className="text-danger text-sm">Error al cargar productos.</p>
            </GlassCard>
          ) : details.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-8 text-center text-text-muted border-dashed">
              <ShoppingBag size={32} className="opacity-20 mb-2" />
              <p className="text-sm">No hay productos en este comprobante.</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {details.map(item => (
                <GlassCard key={item.id} className="p-3 flex justify-between items-center group hover:bg-bg-elevated transition-colors">
                  <div>
                    <div className="font-semibold text-text-primary text-sm">
                      Producto #{item.product_id}
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
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <GlassCard className="space-y-2 bg-bg-surface border border-border-medium">
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
        </GlassCard>
      </div>
    </Drawer>
  );
}
