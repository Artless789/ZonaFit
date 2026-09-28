import { useState, useMemo } from 'react';
import { Search, Filter, WalletCards, Receipt, AlertTriangle, MessageCircle } from 'lucide-react';
import { Badge } from '@shared/ui/Badge';
import { Spinner } from '@shared/ui/Spinner';
import { ErrorState } from '@shared/ui/ErrorState';
import { Select } from '@shared/ui/Select';
import { Pagination } from '@shared/ui/Pagination';
import { useAccountsReceivables } from '../../hooks/useAccountsReceivables';
import { useClients } from '../../hooks/useClients';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { CreditsDrawer } from './CreditsDrawer';
import { PaymentModal } from './PaymentModal';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@shared/utils/formatters';

export function CreditsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedAR, setSelectedAR] = useState<AccountsReceivable | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { query } = useAccountsReceivables({ 
    page, 
    limit, 
    status: statusFilter || undefined 
  });
  
  const { query: clientsQuery } = useClients(1, 500);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const handleOpenDrawer = (ar: AccountsReceivable) => {
    setSelectedAR(ar);
    setIsDrawerOpen(true);
  };

  const handleOpenPayment = (ar: AccountsReceivable) => {
    setSelectedAR(ar);
    setIsPaymentModalOpen(true);
  };

  const formatPrice = formatCurrency;

  const formatShortDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getClientName = (ar: AccountsReceivable) => {
    if (ar.client?.full_name) return ar.client.full_name;
    if (ar.client_name) return ar.client_name;
    const client = clientsQuery.data?.items?.find((c) => c.id === ar.client_id);
    if (client?.full_name) return client.full_name;
    return `Cliente #${ar.client_id}`;
  };

  const getClientDocument = (ar: AccountsReceivable) => {
    if (ar.client?.document) return ar.client.document;
    const client = clientsQuery.data?.items?.find((c) => c.id === ar.client_id);
    return client?.document || 'N/A';
  };

  const getClientPhone = (ar: AccountsReceivable) => {
    if (ar.client?.phone) return ar.client.phone;
    const client = clientsQuery.data?.items?.find((c) => c.id === ar.client_id);
    return client?.phone || undefined;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="warning">Pendiente</Badge>;
      case 'PARTIAL': return <Badge variant="info">Parcial</Badge>;
      case 'PAID': return <Badge variant="success">Pagado</Badge>;
      case 'OVERDUE': return <Badge variant="danger">Vencido</Badge>;
      case 'CANCELLED': return <Badge variant="neutral">Cancelado</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredItems = useMemo(() => {
    if (!query.data?.items) return [];
    let items = query.data.items;
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      items = items.filter(ar => {
        const cName = getClientName(ar).toLowerCase();
        const cDoc = getClientDocument(ar).toLowerCase();
        return cName.includes(lowerSearch) || cDoc.includes(lowerSearch);
      });
    }
    return items;
  }, [query.data?.items, searchTerm, clientsQuery.data?.items]);

  // Derived Stats based only on received data
  const stats = useMemo(() => {
    if (!query.data?.items) return { totalDue: 0, countPending: 0, countPartial: 0, countOverdue: 0 };
    return query.data.items.reduce((acc, ar) => {
      acc.totalDue += ar.balance_due;
      if (ar.status === 'PENDING') acc.countPending++;
      if (ar.status === 'PARTIAL') acc.countPartial++;
      if (ar.status === 'OVERDUE') acc.countOverdue++;
      return acc;
    }, { totalDue: 0, countPending: 0, countPartial: 0, countOverdue: 0 });
  }, [query.data?.items]);

  if (query.isError || clientsQuery.isError) {
    return <ErrorState description="Error al cargar las cuentas por cobrar." onRetry={() => { query.refetch(); clientsQuery.refetch(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-[var(--radius-xl)] border border-brand-primary/25 bg-brand-primary/5 p-4 flex flex-col justify-center shadow-subtle">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <WalletCards size={18} className="text-brand-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total por Cobrar</span>
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">
              {formatPrice(stats.totalDue)}
            </div>
          </div>
          
          <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/80 p-4 flex flex-col justify-center shadow-subtle">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Receipt size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pendientes</span>
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.countPending}</div>
          </div>
          
          <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/80 p-4 flex flex-col justify-center shadow-subtle">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Receipt size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Parciales</span>
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.countPartial}</div>
          </div>
          
          <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/80 p-4 flex flex-col justify-center shadow-subtle">
            <div className="flex items-center gap-2 text-rose-400 mb-1">
              <AlertTriangle size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Vencidas</span>
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.countOverdue}</div>
          </div>
        </div>

      {/* Filters */}
      <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/80 p-4 flex flex-col sm:flex-row gap-4 items-end shadow-subtle">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={17} />
          <input
            type="text"
            placeholder="Buscar por cliente o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-[var(--radius-sm)] border border-border-medium bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all"
          />
        </div>
        <div className="w-full sm:w-48 flex items-center gap-2">
          <Filter size={17} className="text-text-muted shrink-0" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'Todos los Estados' },
              { value: 'PENDING', label: 'Pendientes' },
              { value: 'PARTIAL', label: 'Parciales' },
              { value: 'PAID', label: 'Pagados' },
              { value: 'OVERDUE', label: 'Vencidos' }
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface-panel/90 p-0 overflow-hidden shadow-subtle backdrop-blur-md">
        <div className="overflow-x-auto min-h-75">
          {query.isLoading || clientsQuery.isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="w-8 h-8 text-brand-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <WalletCards size={48} className="opacity-20 mb-3" />
              <p className="text-sm">No se encontraron resultados con estos filtros.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-text-muted uppercase bg-surface-raised/70 border-b border-border-subtle font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5">Venta</th>
                  <th className="px-6 py-3.5 text-right">Original</th>
                  <th className="px-6 py-3.5 text-right">Pagado</th>
                  <th className="px-6 py-3.5 text-right">Saldo</th>
                  <th className="px-6 py-3.5">Vencimiento</th>
                  <th className="px-6 py-3.5 text-center">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredItems.map((ar) => (
                  <tr key={ar.id} className="hover:bg-surface-panel-hover transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-text-primary">{getClientName(ar)}</div>
                      <div className="text-xs text-text-muted font-mono">{getClientDocument(ar)}</div>
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary font-mono">#{ar.sale_id}</td>
                    <td className="px-6 py-3.5 text-right text-text-secondary">{formatPrice(ar.original_amount)}</td>
                    <td className="px-6 py-3.5 text-right text-brand-primary font-medium">{formatPrice(ar.paid_amount)}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-text-primary">{formatPrice(ar.balance_due)}</td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatShortDate(ar.due_date)}</td>
                    <td className="px-6 py-3.5 text-center">{getStatusBadge(ar.status)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5 items-center">
                        {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => {
                              openWhatsAppModal({
                                client: {
                                  id: ar.client_id,
                                  full_name: getClientName(ar),
                                  phone: getClientPhone(ar) || null,
                                },
                                eventType: 'CREDIT_OVERDUE',
                                eventLabel: 'Recordar saldo',
                                contextData: {
                                  balance_due: formatPrice(ar.balance_due),
                                  amount: formatPrice(ar.balance_due),
                                  sale_id: ar.sale_id.toString(),
                                  due_date: formatShortDate(ar.due_date),
                                },
                              });
                            }}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-[var(--radius-sm)] transition-colors inline-flex items-center justify-center cursor-pointer"
                            title="Avisar por WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDrawer(ar)}
                          className="px-3 py-1.5 text-xs font-semibold bg-surface-raised border border-border-medium rounded-[var(--radius-sm)] hover:bg-surface-panel-hover transition-colors text-text-secondary cursor-pointer"
                        >
                          Detalles
                        </button>
                        {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleOpenPayment(ar)}
                            className="px-3 py-1.5 text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-[var(--radius-sm)] hover:bg-brand-primary hover:text-white transition-colors cursor-pointer"
                          >
                            Abonar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {query.data && query.data.total_pages > 1 && (
          <div className="p-4 border-t border-border-subtle bg-surface-panel/40 flex justify-center">
            <Pagination
              page={page}
              totalPages={query.data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Drawer and Modal Components */}
      <CreditsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        ar={selectedAR}
        clientName={selectedAR ? getClientName(selectedAR) : ''}
        clientPhone={selectedAR ? getClientPhone(selectedAR) : undefined}
        onPay={() => {
          setIsDrawerOpen(false);
          setIsPaymentModalOpen(true);
        }}
      />
      
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        ar={selectedAR}
      />

      <WhatsAppModalComponent />
    </div>
  );
}
