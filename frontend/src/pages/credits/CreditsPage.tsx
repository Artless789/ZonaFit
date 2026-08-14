import { useState, useMemo } from 'react';
import { Search, Filter, WalletCards, Receipt, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../../components/shared/GlassCard';
import { Badge } from '../../components/shared/Badge';
import { Spinner } from '../../components/shared/Spinner';
import { ErrorState } from '../../components/shared/ErrorState';
import { Select } from '../../components/shared/Select';
import { Pagination } from '../../components/shared/Pagination';
import { useAccountsReceivables } from '../../hooks/useAccountsReceivables';
import { useClients } from '../../hooks/useClients';
import { CreditsDrawer } from './CreditsDrawer';
import { PaymentModal } from './PaymentModal';
import type { AccountsReceivable } from '../../types/accountsReceivable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  
  const { query: clientsQuery } = useClients();

  const handleOpenDrawer = (ar: AccountsReceivable) => {
    setSelectedAR(ar);
    setIsDrawerOpen(true);
  };

  const handleOpenPayment = (ar: AccountsReceivable) => {
    setSelectedAR(ar);
    setIsPaymentModalOpen(true);
    // If opening from list, drawer might be closed. If opening from drawer, we keep drawer open underneath or close it.
    // In our logic, PaymentModal is separated.
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
  };

  const formatShortDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getClientName = (clientId: number) => {
    const client = clientsQuery.data?.items.find(c => c.id === clientId);
    if (!client) return `Cliente #${clientId}`;
    return client.full_name;
  };

  const getClientDocument = (clientId: number) => {
    const client = clientsQuery.data?.items.find(c => c.id === clientId);
    return client?.document || 'N/A';
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
        const cName = getClientName(ar.client_id).toLowerCase();
        const cDoc = getClientDocument(ar.client_id).toLowerCase();
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
      {/* Header & Stats */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Cuentas por Cobrar</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 flex flex-col justify-center border-brand-primary/20 bg-brand-primary/5">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <WalletCards size={18} />
              <span className="text-sm font-medium">Total por Cobrar (Vista)</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {formatPrice(stats.totalDue)}
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-warning mb-1">
              <Receipt size={18} />
              <span className="text-sm font-medium">Pendientes</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.countPending}</div>
          </GlassCard>
          
          <GlassCard className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-info mb-1">
              <Receipt size={18} />
              <span className="text-sm font-medium">Parciales</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.countPartial}</div>
          </GlassCard>
          
          <GlassCard className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-danger mb-1">
              <AlertTriangle size={18} />
              <span className="text-sm font-medium">Vencidas</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.countOverdue}</div>
          </GlassCard>
        </div>
      </div>

      {/* Filters */}
      <GlassCard className="p-4 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-border-medium bg-bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary transition-fast"
          />
        </div>
        <div className="w-full sm:w-48 flex items-center gap-2">
          <Filter size={18} className="text-text-muted" />
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
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          {query.isLoading || clientsQuery.isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="w-10 h-10 text-brand-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <WalletCards size={48} className="opacity-20 mb-3" />
              <p>No se encontraron resultados con estos filtros.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary uppercase bg-bg-surface border-b border-border-light">
                <tr>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Venta</th>
                  <th className="px-6 py-4 font-medium text-right">Original</th>
                  <th className="px-6 py-4 font-medium text-right">Pagado</th>
                  <th className="px-6 py-4 font-medium text-right">Saldo</th>
                  <th className="px-6 py-4 font-medium">Vencimiento</th>
                  <th className="px-6 py-4 font-medium text-center">Estado</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredItems.map((ar) => (
                  <tr key={ar.id} className="hover:bg-bg-surface/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-text-primary">{getClientName(ar.client_id)}</div>
                      <div className="text-xs text-text-muted">{getClientDocument(ar.client_id)}</div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">#{ar.sale_id}</td>
                    <td className="px-6 py-4 text-right text-text-secondary">{formatPrice(ar.original_amount)}</td>
                    <td className="px-6 py-4 text-right text-brand-primary">{formatPrice(ar.paid_amount)}</td>
                    <td className="px-6 py-4 text-right font-bold text-text-primary">{formatPrice(ar.balance_due)}</td>
                    <td className="px-6 py-4 text-text-secondary">{formatShortDate(ar.due_date)}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(ar.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenDrawer(ar)}
                          className="px-3 py-1.5 text-xs font-medium bg-bg-elevated border border-border-medium rounded hover:bg-border-light transition-colors text-text-secondary"
                        >
                          Detalles
                        </button>
                        {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleOpenPayment(ar)}
                            className="px-3 py-1.5 text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded hover:bg-brand-primary hover:text-white transition-colors"
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
          <div className="p-4 border-t border-border-light bg-bg-surface flex justify-center">
            <Pagination
              page={page}
              totalPages={query.data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </GlassCard>

      {/* Drawer and Modal Components */}
      <CreditsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        ar={selectedAR}
        clientName={selectedAR ? getClientName(selectedAR.client_id) : ''}
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
    </div>
  );
}
