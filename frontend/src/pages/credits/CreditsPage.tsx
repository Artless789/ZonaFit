import { useState, useMemo } from 'react';
import { Search, Filter, WalletCards, Receipt, AlertTriangle, MessageCircle, Clock, ChevronRight, Coins, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@shared/ui/Spinner';
import { ErrorState } from '@shared/ui/ErrorState';
import { Select } from '@shared/ui/Select';
import { Pagination } from '@shared/ui/Pagination';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { useAccountsReceivables } from '../../hooks/useAccountsReceivables';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { CreditsDrawer } from './CreditsDrawer';
import { PaymentModal } from './PaymentModal';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@shared/utils/formatters';
import { cn } from '@shared/utils/cn';

export function CreditsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [activeTab, setActiveTab] = useState<'active' | 'paid'>('active');
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
      return format(new Date(dateString), "dd MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getClientName = (ar: AccountsReceivable) => {
    return ar.client?.full_name || ar.client_name || `Cliente #${ar.client_id}`;
  };

  const getClientDocument = (ar: AccountsReceivable) => {
    return ar.client?.document || 'Sin documento';
  };

  const getClientPhone = (ar: AccountsReceivable) => {
    return ar.client?.phone || undefined;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return <StatusBadge status="warning" label="PENDIENTE" size="sm" mode="pill" />;
      case 'PARTIAL':
        return <StatusBadge status="info" label="PARCIAL" size="sm" mode="pill" />;
      case 'PAID':
        return <StatusBadge status="paid" label="PAGADO" size="sm" mode="pill" />;
      case 'OVERDUE':
        return <StatusBadge status="danger" label="VENCIDO" size="sm" mode="pill" />;
      case 'CANCELLED':
        return <StatusBadge status="neutral" label="CANCELADO" size="sm" mode="pill" />;
      default:
        return <StatusBadge status="neutral" label={status} size="sm" mode="pill" />;
    }
  };

  const activeCount = useMemo(() => {
    if (!query.data?.items) return 0;
    return query.data.items.filter(ar => ar.balance_due > 0 && ar.status !== 'PAID').length;
  }, [query.data]);

  const paidCount = useMemo(() => {
    if (!query.data?.items) return 0;
    return query.data.items.filter(ar => ar.balance_due <= 0 || ar.status === 'PAID').length;
  }, [query.data]);

  const filteredItems = useMemo(() => {
    if (!query.data?.items) return [];
    let items = query.data.items;

    // Strict separation: Active portfolio vs Paid history
    if (activeTab === 'active') {
      items = items.filter(ar => ar.balance_due > 0 && ar.status !== 'PAID');
    } else {
      items = items.filter(ar => ar.balance_due <= 0 || ar.status === 'PAID');
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      items = items.filter(ar => {
        const cName = getClientName(ar).toLowerCase();
        const cDoc = getClientDocument(ar).toLowerCase();
        return cName.includes(lowerSearch) || cDoc.includes(lowerSearch);
      });
    }
    return items;
  }, [query.data, activeTab, searchTerm]);

  // Derived Stats based ONLY on active receivables (paid accounts never count towards debt)
  const stats = useMemo(() => {
    if (!query.data?.items) return { totalDue: 0, countPending: 0, countPartial: 0, countOverdue: 0 };
    return query.data.items.reduce((acc, ar) => {
      if (ar.balance_due > 0 && ar.status !== 'PAID' && ar.status !== 'CANCELLED') {
        acc.totalDue += ar.balance_due;
        if (ar.status === 'PENDING') acc.countPending++;
        if (ar.status === 'PARTIAL') acc.countPartial++;
        if (ar.status === 'OVERDUE') acc.countOverdue++;
      }
      return acc;
    }, { totalDue: 0, countPending: 0, countPartial: 0, countOverdue: 0 });
  }, [query.data]);

  const getOverdueDays = (dueDateStr: string, balanceDue: number) => {
    if (balanceDue <= 0) return null;
    try {
      const dueDate = parseISO(dueDateStr);
      const diff = differenceInCalendarDays(new Date(), dueDate);
      return diff;
    } catch {
      return null;
    }
  };

  if (query.isError) {
    const errorDetail = (query.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    const isSubRestricted = errorDetail === 'SUBSCRIPTION_REQUIRED';
    return (
      <ErrorState
        title={isSubRestricted ? "Acceso Restringido" : "Error al cargar las cuentas por cobrar"}
        description={
          isSubRestricted
            ? "El acceso a las cuentas por cobrar está restringido debido al estado comercial de tu gimnasio."
            : (query.error as Error)?.message || "No pudimos cargar la información de las cuentas por cobrar."
        }
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border-subtle pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <SectionEyebrow
              index="08"
              label="GESTIÓN FINANCIERA // CARTERA & COBRANZAS"
              title="Cuentas por Cobrar (CxC)"
            />
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-surface-raised border border-border-subtle text-text-secondary">
              {stats.countPending + stats.countPartial} Créditos Vigentes
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Control de cartera de clientes, monitoreo de vencimientos, abonos parciales y cobranza directa.
          </p>
        </div>
      </div>

      {/* Financial Portfolio KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Cartera Total */}
        <div className="rounded-xl border border-brand-primary/30 bg-surface-panel/95 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-brand-primary">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary font-mono">Cartera Total por Cobrar</span>
            <WalletCards size={16} className="text-brand-primary" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-text-primary tracking-tight font-mono">
              {formatPrice(stats.totalDue)}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">Saldo consolidado pendiente</p>
          </div>
        </div>

        {/* Cuentas Vencidas / En Mora */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 font-mono">Cuentas en Mora</span>
            <AlertTriangle size={16} className="text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-400 tracking-tight font-mono">
              {stats.countOverdue}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">Vencimiento superado</p>
          </div>
        </div>

        {/* Abonos Parciales */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 font-mono">Abonos Parciales</span>
            <Clock size={16} className="text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-400 tracking-tight font-mono">
              {stats.countPartial}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">Con abonos registrados</p>
          </div>
        </div>

        {/* Créditos Pendientes */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">Pendientes Totales</span>
            <Receipt size={16} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">
              {stats.countPending}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">Sin ningún abono aún</p>
          </div>
        </div>
      </div>

      {/* Portfolio Segmented Tabs: Cartera Activa vs Historial de Pagadas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="bg-surface-panel border border-border-subtle p-1 rounded-[var(--radius-xl)] shadow-subtle flex relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('active');
              setStatusFilter('');
            }}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-[var(--radius-lg)] transition-all cursor-pointer flex-1 sm:flex-initial',
              activeTab === 'active'
                ? 'bg-surface-raised text-text-primary border border-border-medium shadow-elevated'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <WalletCards size={14} className={activeTab === 'active' ? 'text-brand-primary' : ''} />
            <span>Cartera Activa</span>
            <span className="ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-bold">
              {activeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('paid');
              setStatusFilter('');
            }}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-[var(--radius-lg)] transition-all cursor-pointer flex-1 sm:flex-initial',
              activeTab === 'paid'
                ? 'bg-surface-raised text-text-primary border border-border-medium shadow-elevated'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <CheckCircle2 size={14} className={activeTab === 'paid' ? 'text-emerald-400' : ''} />
            <span>Historial de Pagadas</span>
            <span className="ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
              {paidCount}
            </span>
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {activeTab === 'active'
            ? 'Monitoreando cuentas por cobrar con saldo activo mayor a $0.'
            : 'Historial de créditos totalmente saldados y cancelados.'}
        </p>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-border-subtle bg-surface-panel/85 p-3.5 flex flex-col sm:flex-row gap-3 items-center shadow-subtle backdrop-blur-md">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre de cliente o número de documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-lg border border-border-medium bg-surface-base text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all font-sans"
          />
        </div>
        {activeTab === 'active' && (
          <div className="w-full sm:w-52 flex items-center gap-2">
            <Filter size={15} className="text-text-muted shrink-0" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'Todos los Estados' },
                { value: 'PENDING', label: 'Pendientes' },
                { value: 'PARTIAL', label: 'Parciales' },
                { value: 'OVERDUE', label: 'Vencidos' }
              ]}
            />
          </div>
        )}
      </div>

      {/* Receivables Table */}
      <div className="rounded-2xl border border-border-subtle bg-surface-panel/90 p-0 overflow-hidden shadow-subtle backdrop-blur-md">
        <div className="overflow-x-auto min-h-75">
          {query.isLoading ? (
            <div className="flex flex-col items-center justify-center h-52 text-text-muted space-y-3">
              <Spinner className="w-7 h-7 text-brand-primary" />
              <p className="text-xs font-mono tracking-wider uppercase text-text-secondary">Consultando cartera de clientes...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-text-muted space-y-2">
              <WalletCards size={40} className="opacity-20" />
              <p className="text-sm font-medium">
                {searchTerm || statusFilter
                  ? "No se encontraron créditos que coincidan con los filtros."
                  : "No hay cuentas por cobrar registradas actualmente."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-text-muted uppercase bg-surface-raised/80 border-b border-border-subtle font-semibold tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3.5">Cliente / Socio</th>
                  <th className="px-5 py-3.5">Venta</th>
                  <th className="px-5 py-3.5 text-right">Original</th>
                  <th className="px-5 py-3.5 text-right">Pagado</th>
                  <th className="px-5 py-3.5 text-right">Saldo Pendiente</th>
                  <th className="px-5 py-3.5">Vencimiento</th>
                  <th className="px-5 py-3.5 text-center">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredItems.map((ar) => {
                  const overdueDays = getOverdueDays(ar.due_date, ar.balance_due);
                  const isOverdue = overdueDays !== null && overdueDays > 0;

                  return (
                    <tr key={ar.id} className="hover:bg-surface-panel-hover transition-colors group">
                      {/* Cliente */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-bold text-brand-primary font-mono shrink-0">
                            {getClientName(ar).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-text-primary text-xs">{getClientName(ar)}</div>
                            <div className="text-[11px] text-text-muted font-mono">{getClientDocument(ar)}</div>
                          </div>
                        </div>
                      </td>

                      {/* Venta */}
                      <td className="px-5 py-3.5 text-text-secondary font-mono font-medium">
                        #{ar.sale_id}
                      </td>

                      {/* Original */}
                      <td className="px-5 py-3.5 text-right text-text-secondary font-mono">
                        {formatPrice(ar.original_amount)}
                      </td>

                      {/* Pagado */}
                      <td className="px-5 py-3.5 text-right text-emerald-400 font-mono font-semibold">
                        {formatPrice(ar.paid_amount)}
                      </td>

                      {/* Saldo Pendiente */}
                      <td className="px-5 py-3.5 text-right font-mono font-black text-sm">
                        <span className={ar.balance_due > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatPrice(ar.balance_due)}
                        </span>
                      </td>

                      {/* Vencimiento & Mora */}
                      <td className="px-5 py-3.5 font-mono">
                        <div className="text-text-secondary font-medium">
                          {formatShortDate(ar.due_date)}
                        </div>
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            {overdueDays} días en mora
                          </span>
                        ) : ar.balance_due > 0 ? (
                          <span className="text-[10px] text-emerald-400 font-medium">
                            Al día
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-3.5 text-center">
                        {getStatusBadge(ar.status)}
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-3.5 text-right">
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
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-md transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Gestionar cobranza por WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(ar)}
                            className="px-2.5 py-1 text-xs font-semibold bg-surface-raised border border-border-medium rounded-md hover:bg-surface-panel-hover transition-colors text-text-secondary cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Detalle</span>
                            <ChevronRight size={12} />
                          </button>
                          {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(ar)}
                              className="px-2.5 py-1 text-xs font-bold bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Coins size={12} />
                              <span>Abonar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {query.data && query.data.total_pages > 1 && (
          <div className="p-3.5 border-t border-border-subtle bg-surface-panel/40 flex justify-center">
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
