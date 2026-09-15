import { useState } from 'react';
import { Badge } from '@shared/ui/Badge';
import { Spinner } from '@shared/ui/Spinner';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { InvoiceDrawer } from './InvoiceDrawer';
import { Search, FileText, ChevronLeft, ChevronRight, Eye, MessageCircle } from 'lucide-react';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import type { Invoice } from '@shared/types/invoice';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@shared/utils/formatters';

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const limit = 10;
  
  const { query: invoicesQuery } = useInvoices({ page, limit, search, status: statusFilter });
  const { query: clientsQuery } = useClients();
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const handleOpenDrawer = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDrawerOpen(true);
  };

  const getClientName = (clientId?: number | null) => {
    if (!clientId) return 'Consumidor Final';
    const client = clientsQuery.data?.items?.find((c: any) => c.id === clientId);
    return client ? client.full_name : 'Cargando...';
  };

  const getClientDocument = (clientId?: number | null) => {
    if (!clientId) return 'N/A';
    const client = clientsQuery.data?.items?.find((c: any) => c.id === clientId);
    return client ? client.document : 'N/A';
  };

  const formatPrice = formatCurrency;
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: es });
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

  const { data, isLoading, isError } = invoicesQuery;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Comprobantes</h1>
        <p className="text-text-secondary">Historial de comprobantes de venta emitidos.</p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full max-w-md relative">
          <Input 
            placeholder="Buscar por número..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full"
          />
          <Search className="absolute left-3 top-3.5 text-text-muted" size={18} />
        </div>
        <div className="w-full sm:w-64">
          <Select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'ISSUED', label: 'Emitidos' },
              { value: 'DRAFT', label: 'Borradores' },
              { value: 'CANCELLED', label: 'Cancelados' }
            ]}
          />
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-light/50 bg-bg-surface/50">
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Número</th>
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Cliente</th>
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Fecha</th>
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Total</th>
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Estado</th>
                <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Spinner className="mx-auto w-8 h-8" />
                    <p className="mt-2 text-text-muted text-sm">Cargando comprobantes...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-danger">
                    <p>No pudimos cargar los comprobantes.</p>
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text-muted">
                    <div className="flex justify-center mb-4 opacity-20"><FileText width={48} height={48} /></div>
                    <p className="text-lg font-medium text-text-primary">No hay comprobantes registrados.</p>
                    <p className="text-sm mt-1">Los comprobantes aparecerán aquí cuando se emitan facturas desde ventas.</p>
                  </td>
                </tr>
              ) : (
                data?.items?.map((invoice: Invoice) => (
                  <tr key={invoice.id} className="hover:bg-bg-surface/30 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-primary">{invoice.invoice_number}</div>
                      <div className="text-xs text-text-muted">Ref. Venta #{invoice.sale_id}</div>
                    </td>
                    <td className="p-4 text-text-primary font-medium">
                      {getClientName(invoice.client_id)}
                    </td>
                    <td className="p-4 text-text-secondary text-sm">
                      {formatDate(invoice.created_at)}
                    </td>
                    <td className="p-4 font-bold text-text-primary">
                      {formatPrice(invoice.total)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.client_id && (
                          <button
                            type="button"
                            onClick={() => {
                              const client = clientsQuery.data?.items?.find((c: any) => c.id === invoice.client_id);
                              openWhatsAppModal({
                                client: {
                                  id: invoice.client_id!,
                                  full_name: client ? client.full_name : getClientName(invoice.client_id),
                                  phone: client?.phone || null,
                                },
                                eventType: 'PAYMENT_RECEIVED',
                                eventLabel: 'Enviar comprobante',
                                contextData: {
                                  invoice_number: invoice.invoice_number,
                                  amount: formatPrice(invoice.total),
                                  payment_method: invoice.payment_method || 'CASH',
                                },
                              });
                            }}
                            className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors bg-bg-surface/50 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                            title="Enviar comprobante por WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDrawer(invoice)}
                          className="p-2 text-text-muted hover:text-primary transition-colors bg-bg-surface/50 hover:bg-bg-surface rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="border-t border-border-light/50 p-4 flex items-center justify-between text-sm">
            <span className="text-text-muted">
              Mostrando página <span className="font-medium text-text-primary">{page}</span> de <span className="font-medium text-text-primary">{data.total_pages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border-medium"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border-medium"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <InvoiceDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        invoice={selectedInvoice}
        clientName={selectedInvoice ? getClientName(selectedInvoice.client_id) : undefined}
        clientDocument={selectedInvoice ? getClientDocument(selectedInvoice.client_id) : undefined}
      />

      <WhatsAppModalComponent />
    </div>
  );
}
