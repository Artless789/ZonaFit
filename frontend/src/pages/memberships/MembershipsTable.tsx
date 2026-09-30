import { useState, useMemo } from 'react';
import {
  Ban,
  CheckCircle2,
  UserCheck,
  Clock,
  Eye,
  Search,
  X,
  ShieldAlert,
  History,
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import type { Membership } from '@shared/types/membership';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Modal } from '@shared/ui/Modal';
import { Pagination } from '@shared/ui/Pagination';
import { cn } from '@shared/utils/cn';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { formatCurrency } from '@shared/utils/formatters';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';

export type EnrichedMembership = Membership & {
  clientName: string;
  planName: string;
};

export interface CanonicalEnrichedMembership extends EnrichedMembership {
  historyCount: number;
  history: EnrichedMembership[];
}

export type MembershipTab = 'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

interface MembershipsTableProps {
  memberships: EnrichedMembership[];
  onToggleStatus: (membership: Membership) => void;
  onViewDetails?: (membership: Membership) => void;
  onRenew?: (membership: Membership) => void;
}

export function MembershipsTable({
  memberships,
  onToggleStatus,
  onViewDetails,
  onRenew,
}: MembershipsTableProps) {
  const [activeTab, setActiveTab] = useState<MembershipTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [historyModalData, setHistoryModalData] = useState<{
    clientName: string;
    memberships: EnrichedMembership[];
  } | null>(null);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();
  const pageSize = 10;

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d 'de' MMM, yyyy", { locale: es });
    } catch {
      return isoString;
    }
  };

  const getDaysRemaining = (endDateStr: string): number => {
    try {
      const end = parseISO(endDateStr);
      const now = new Date();
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  };

  const getMembershipWhatsAppContext = (m: CanonicalEnrichedMembership | Membership) => {
    const totalPaid =
      m.total_paid ?? (m.payments || []).reduce((acc, p) => acc + Number(p.amount), 0);
    const pendingBalance =
      m.pending_balance ?? Math.max(0, Number(m.price) - totalPaid);
    const daysLeft = getDaysRemaining(m.end_date);
    const isExpired = !m.is_active || m.status === 'EXPIRED' || daysLeft < 0;

    const planLabel =
      'planName' in m ? (m as EnrichedMembership).planName : m.membership_plan?.name || 'Membresía';

    if (pendingBalance > 0) {
      return {
        eventType: 'CREDIT_OVERDUE',
        eventLabel: 'Recordar saldo',
        tooltip: `Recordar saldo pendiente (${formatCurrency(pendingBalance)})`,
        contextData: {
          balance_due: formatCurrency(pendingBalance),
          membership_name: planLabel,
          expiry_date: formatDate(m.end_date),
        },
      };
    }

    if (isExpired) {
      return {
        eventType: 'MEMBERSHIP_EXPIRED',
        eventLabel: 'Avisar vencida',
        tooltip: 'Avisar membresía vencida',
        contextData: {
          membership_name: planLabel,
          expiry_date: formatDate(m.end_date),
        },
      };
    }

    if (daysLeft <= 7) {
      return {
        eventType: 'MEMBERSHIP_EXPIRY',
        eventLabel: 'Recordar vencimiento',
        tooltip: `Recordar vencimiento (${daysLeft === 0 ? 'vence hoy' : `${daysLeft} días restantes`})`,
        contextData: {
          membership_name: planLabel,
          expiry_date: formatDate(m.end_date),
          days_left: daysLeft.toString(),
        },
      };
    }

    return {
      eventType: 'GENERAL',
      eventLabel: 'Contactar por WhatsApp',
      tooltip: 'Contactar cliente por WhatsApp',
      contextData: {
        membership_name: planLabel,
        expiry_date: formatDate(m.end_date),
      },
    };
  };

  // Grouping by client: keeps active membership first, then most recent end_date
  const groupedMemberships = useMemo<CanonicalEnrichedMembership[]>(() => {
    const clientOrder: number[] = [];
    const clientMap = new Map<number, EnrichedMembership[]>();

    for (const m of memberships) {
      const key = m.client_id || m.id;
      if (!clientMap.has(key)) {
        clientOrder.push(key);
        clientMap.set(key, []);
      }
      clientMap.get(key)!.push(m);
    }

    const isMembershipActive = (m: EnrichedMembership) => {
      const days = getDaysRemaining(m.end_date);
      return m.is_active && m.status?.toUpperCase() === 'ACTIVE' && days >= 0;
    };

    return clientOrder.map((key) => {
      const items = clientMap.get(key)!;

      const sortedGroup = [...items].sort((a, b) => {
        const aActive = isMembershipActive(a);
        const bActive = isMembershipActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        const timeA = new Date(a.end_date).getTime() || 0;
        const timeB = new Date(b.end_date).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;

        return b.id - a.id;
      });

      return {
        ...sortedGroup[0],
        historyCount: items.length,
        history: sortedGroup,
      };
    });
  }, [memberships]);

  // Tab counts
  const counts = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;

    groupedMemberships.forEach((m) => {
      const days = getDaysRemaining(m.end_date);
      const isAct = m.is_active && m.status?.toUpperCase() === 'ACTIVE' && days >= 0;
      if (isAct) {
        active++;
        if (days <= 7) expiring++;
      } else {
        expired++;
      }
    });

    return {
      all: groupedMemberships.length,
      active,
      expiring,
      expired,
    };
  }, [groupedMemberships]);

  // Filtered memberships
  const filteredMemberships = useMemo(() => {
    return groupedMemberships.filter((m) => {
      const days = getDaysRemaining(m.end_date);
      const isAct = m.is_active && m.status?.toUpperCase() === 'ACTIVE' && days >= 0;

      // Filter by tab
      if (activeTab === 'ACTIVE' && !isAct) return false;
      if (activeTab === 'EXPIRING' && (!isAct || days > 7)) return false;
      if (activeTab === 'EXPIRED' && isAct) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientDisplayName =
          m.clientName && m.clientName !== 'Desconocido'
            ? m.clientName
            : m.client?.full_name || m.client_name || '';
        const matchClient = clientDisplayName.toLowerCase().includes(q);
        const matchPlan = m.planName?.toLowerCase().includes(q);
        const matchId = String(m.client_id).includes(q) || String(m.id).includes(q);
        const matchTrainer = m.trainer_name?.toLowerCase().includes(q);
        if (!matchClient && !matchPlan && !matchId && !matchTrainer) return false;
      }

      return true;
    });
  }, [groupedMemberships, activeTab, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMemberships.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedMemberships = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMemberships.slice(start, start + pageSize);
  }, [filteredMemberships, currentPage, pageSize]);

  const handleTabChange = (tab: MembershipTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-[24px] border border-dashed border-border-subtle bg-surface-panel/80 shadow-subtle backdrop-blur-md">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 text-brand-primary border border-brand-primary/20">
          <UserCheck size={30} />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1">
          Sin suscripciones registradas
        </h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Asigna un plan de membresía a un socio para comenzar a llevar el control de vigencias y cobros.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control Bar: Filter Tabs & Fast Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-panel/80 p-3.5 rounded-[20px] border border-border-subtle shadow-subtle backdrop-blur-md">
        {/* State Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            type="button"
            onClick={() => handleTabChange('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === 'ALL'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle'
            )}
          >
            <span>Todos</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-surface-base text-text-muted'
              )}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ACTIVE')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-raised text-text-muted hover:text-emerald-400 border border-border-subtle'
            )}
          >
            <span>Activas</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                activeTab === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-surface-base text-emerald-400'
              )}
            >
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRING')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === 'EXPIRING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-raised text-text-muted hover:text-amber-400 border border-border-subtle'
            )}
          >
            <Clock size={13} className="shrink-0" />
            <span>Por Vencer (≤7d)</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                activeTab === 'EXPIRING' ? 'bg-white/20 text-white' : 'bg-surface-base text-amber-400'
              )}
            >
              {counts.expiring}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRED')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === 'EXPIRED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-surface-raised text-text-muted hover:text-rose-400 border border-border-subtle'
            )}
          >
            <span>Vencidas</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                activeTab === 'EXPIRED' ? 'bg-white/20 text-white' : 'bg-surface-base text-rose-400'
              )}
            >
              {counts.expired}
            </span>
          </button>
        </div>

        {/* Fast Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
          <input
            type="text"
            placeholder="Buscar socio, documento o plan..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-9 pl-9 pr-8 rounded-[var(--radius-md)] border border-border-medium bg-surface-base text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <TableContainer className="rounded-[24px] border-border-subtle bg-surface-panel/90 backdrop-blur-md shadow-subtle">
        {filteredMemberships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mb-3 text-text-muted border border-border-subtle">
              {activeTab === 'EXPIRING' ? (
                <Clock size={20} className="text-amber-400" />
              ) : activeTab === 'EXPIRED' ? (
                <ShieldAlert size={20} className="text-rose-400" />
              ) : (
                <Search size={20} />
              )}
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">
              {activeTab === 'EXPIRING'
                ? 'No hay membresías próximas a vencer en los siguientes 7 días'
                : activeTab === 'ACTIVE'
                ? 'No hay membresías activas registradas'
                : activeTab === 'EXPIRED'
                ? 'No hay membresías vencidas en este momento'
                : 'No se encontraron resultados'}
            </h4>
            <p className="text-xs text-text-secondary max-w-sm mb-4">
              {searchQuery
                ? `No se encontraron membresías que coincidan con "${searchQuery}".`
                : 'Selecciona otra pestaña o limpia el buscador para ver más registros.'}
            </p>
            {(searchQuery || activeTab !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="px-3.5 py-1.5 rounded-[var(--radius-md)] bg-surface-raised border border-border-medium text-xs font-semibold text-text-primary hover:bg-surface-panel-hover transition-colors cursor-pointer"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 py-3.5">Socio / Cliente</TableHead>
                <TableHead className="px-5 py-3.5">Plan Asignado</TableHead>
                <TableHead className="px-5 py-3.5">Vigencia & Días</TableHead>
                <TableHead className="px-5 py-3.5">Precio & Saldos</TableHead>
                <TableHead className="px-5 py-3.5 text-center">Estado</TableHead>
                <TableHead className="px-5 py-3.5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMemberships.map((membership) => {
                const days = getDaysRemaining(membership.end_date);
                const isAct =
                  membership.is_active &&
                  membership.status?.toUpperCase() === 'ACTIVE' &&
                  days >= 0;
                const totalPaid =
                  membership.total_paid ??
                  (membership.payments || []).reduce((acc, p) => acc + Number(p.amount), 0);
                const pendingBalance =
                  membership.pending_balance ?? Math.max(0, Number(membership.price) - totalPaid);

                const clientDisplayName =
                  membership.clientName && membership.clientName !== 'Desconocido'
                    ? membership.clientName
                    : membership.client?.full_name ||
                      membership.client_name ||
                      `Cliente #${membership.client_id}`;

                const ctx = getMembershipWhatsAppContext(membership);

                return (
                  <TableRow
                    key={membership.id}
                    className={cn(
                      'hover:bg-surface-panel-hover transition-colors group',
                      !membership.is_active && 'opacity-50'
                    )}
                  >
                    {/* Socio / Cliente */}
                    <TableCell className="px-5 py-3.5">
                      <div className="font-bold text-text-primary text-sm">
                        {clientDisplayName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="font-mono text-[11px]">ID: #{membership.client_id}</span>
                        {membership.historyCount > 1 && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryModalData({
                                  clientName: clientDisplayName,
                                  memberships: membership.history,
                                })
                              }
                              className="inline-flex items-center gap-1 text-brand-primary hover:underline font-semibold text-[11px] cursor-pointer"
                              title={`Ver todos los ${membership.historyCount} planes de este cliente`}
                            >
                              <History size={11} />
                              <span>Historial ({membership.historyCount})</span>
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>

                    {/* Plan Asignado */}
                    <TableCell className="px-5 py-3.5">
                      <div className="font-semibold text-text-primary text-xs">
                        {membership.planName}
                      </div>
                      {membership.trainer_name ? (
                        <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[140px]">
                          Coach: {membership.trainer_name}
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-secondary font-mono mt-0.5">
                          Sin entrenador
                        </div>
                      )}
                    </TableCell>

                    {/* Vigencia & Días Restantes */}
                    <TableCell className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                          <span>{formatDate(membership.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-text-primary">
                          <Clock
                            size={11}
                            className={cn(
                              'shrink-0',
                              !isAct ? 'text-rose-400' : days <= 7 ? 'text-amber-400' : 'text-text-muted'
                            )}
                          />
                          <span>{formatDate(membership.end_date)}</span>
                        </div>
                        {/* Countdown Pill */}
                        <div className="mt-0.5">
                          {!membership.is_active ? (
                            <span className="text-[10px] font-mono text-text-muted">
                              Inactiva
                            </span>
                          ) : !isAct ? (
                            <span className="text-[10px] font-mono font-bold text-rose-400">
                              Vencida hace {Math.abs(days)}d
                            </span>
                          ) : days === 0 ? (
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              Vence hoy
                            </span>
                          ) : days <= 7 ? (
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              Quedan {days} días
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-text-muted">
                              Quedan {days} días
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Precio & Desglose */}
                    <TableCell className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-sm text-text-primary">
                          {formatCurrency(membership.price)}
                        </span>
                        {membership.discount && membership.discount > 0 && (
                          <span className="text-[10px] font-mono text-emerald-400">
                            Desc: -{formatCurrency(membership.discount)}
                          </span>
                        )}
                        {pendingBalance > 0 && (
                          <span className="text-[10px] font-mono font-bold text-rose-400 mt-0.5">
                            Debe: {formatCurrency(pendingBalance)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="px-5 py-3.5 text-center">
                      {!membership.is_active ? (
                        <StatusBadge status="neutral" size="sm" label="Cancelada" />
                      ) : !isAct ? (
                        <StatusBadge status="danger" size="sm" label="Vencida" />
                      ) : days <= 7 ? (
                        <StatusBadge
                          status="warning"
                          size="sm"
                          label={`Por vencer (${days === 0 ? 'Hoy' : `${days}d`})`}
                        />
                      ) : (
                        <StatusBadge status="active" size="sm" label="Activa" />
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* WhatsApp Web Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const clientInfo = {
                              id: membership.client_id,
                              full_name: clientDisplayName,
                              phone: membership.client?.phone || null,
                            };
                            openWhatsAppModal({
                              client: clientInfo,
                              eventType: ctx.eventType,
                              eventLabel: ctx.eventLabel,
                              contextData: ctx.contextData,
                            });
                          }}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                          title={ctx.tooltip}
                        >
                          <MessageCircle size={15} />
                        </button>

                        {/* Direct Renewal CTA */}
                        {onRenew && (
                          <button
                            type="button"
                            onClick={() => onRenew(membership)}
                            className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            title="Renovar Membresía"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}

                        {/* View Details */}
                        {onViewDetails && (
                          <button
                            type="button"
                            onClick={() => onViewDetails(membership)}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-raised rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            title="Ver Ficha de Membresía"
                          >
                            <Eye size={15} />
                          </button>
                        )}

                        {/* Cancel / Reactivate Subscription */}
                        <button
                          type="button"
                          onClick={() => onToggleStatus(membership)}
                          className={cn(
                            'p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer',
                            membership.is_active
                              ? 'text-text-muted hover:text-rose-400 hover:bg-rose-500/10'
                              : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'
                          )}
                          title={
                            membership.is_active
                              ? 'Cancelar Suscripción'
                              : 'Reactivar Suscripción'
                          }
                        >
                          <Ban size={15} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Footer with Pagination */}
        {filteredMemberships.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 bg-surface-panel/50 border-t border-border-subtle">
            <p className="text-xs text-text-muted text-center sm:text-left font-mono">
              Mostrando <span className="font-semibold text-text-primary">{(currentPage - 1) * pageSize + 1}</span> a{' '}
              <span className="font-semibold text-text-primary">
                {Math.min(currentPage * pageSize, filteredMemberships.length)}
              </span>{' '}
              de <span className="font-semibold text-text-primary">{filteredMemberships.length}</span> socios
            </p>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </TableContainer>

      {/* Modal de Historial de Planes por Cliente */}
      <Modal
        isOpen={!!historyModalData}
        onClose={() => setHistoryModalData(null)}
        title={`Historial de Membresías — ${historyModalData?.clientName}`}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 py-1">
          <p className="text-xs text-text-muted">
            Mostrando todos los planes y suscripciones registradas para este cliente ({historyModalData?.memberships.length || 0} registros).
          </p>

          <TableContainer className="rounded-[var(--radius-lg)] border-border-subtle bg-surface-panel/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-2.5">Plan</TableHead>
                  <TableHead className="px-4 py-2.5">Vigencia</TableHead>
                  <TableHead className="px-4 py-2.5">Precio Cobrado</TableHead>
                  <TableHead className="px-4 py-2.5 text-center">Estado</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyModalData?.memberships.map((m) => {
                  const mDays = getDaysRemaining(m.end_date);
                  const isMAct =
                    m.is_active && m.status?.toUpperCase() === 'ACTIVE' && mDays >= 0;
                  const mCtx = getMembershipWhatsAppContext(m);

                  return (
                    <TableRow key={m.id} className="hover:bg-surface-panel-hover transition-colors">
                      <TableCell className="px-4 py-2.5">
                        <div className="font-semibold text-text-primary text-xs">{m.planName}</div>
                        <div className="text-[10px] text-text-muted font-mono">ID: #{m.id}</div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 font-mono text-xs">
                        <div className="text-text-primary">{formatDate(m.start_date)}</div>
                        <div className="text-[11px] text-text-muted">hasta {formatDate(m.end_date)}</div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 font-mono font-medium text-text-primary text-xs">
                        {formatCurrency(m.price)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center">
                        {!m.is_active ? (
                          <StatusBadge status="neutral" size="sm" label="Cancelada" />
                        ) : !isMAct ? (
                          <StatusBadge status="danger" size="sm" label="Vencida" />
                        ) : (
                          <StatusBadge status="active" size="sm" label="Activa" />
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const clientInfo = {
                                id: m.client_id,
                                full_name: historyModalData?.clientName || m.client?.full_name || `Cliente #${m.client_id}`,
                                phone: m.client?.phone || null,
                              };
                              openWhatsAppModal({
                                client: clientInfo,
                                eventType: mCtx.eventType,
                                eventLabel: mCtx.eventLabel,
                                contextData: mCtx.contextData,
                              });
                            }}
                            className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                            title={mCtx.tooltip}
                          >
                            <MessageCircle size={13} />
                            <span>{mCtx.eventLabel}</span>
                          </button>
                          {onViewDetails && (
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryModalData(null);
                                onViewDetails(m);
                              }}
                              className="px-2.5 py-1 text-xs text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                              title="Ver Detalle Completo"
                            >
                              <Eye size={13} />
                              <span>Ver</span>
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setHistoryModalData(null)}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-raised hover:bg-surface-panel-hover border border-border-medium rounded-[var(--radius-md)] transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      <WhatsAppModalComponent />
    </div>
  );
}
