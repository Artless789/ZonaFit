import { useState, useMemo } from 'react';
import { Ban, CheckCircle2, UserCheck, Clock, Eye, Search, AlertTriangle, X, ShieldAlert, History, MessageCircle } from 'lucide-react';
import type { Membership } from '@shared/types/membership';
import { Badge } from '@shared/ui/Badge';
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
}

export function MembershipsTable({ memberships, onToggleStatus, onViewDetails }: MembershipsTableProps) {
  const [activeTab, setActiveTab] = useState<MembershipTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [historyModalData, setHistoryModalData] = useState<{ clientName: string; memberships: EnrichedMembership[] } | null>(null);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();
  const pageSize = 10;

  const formatPrice = formatCurrency;

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
    const totalPaid = m.total_paid ?? (m.payments || []).reduce((acc, p) => acc + Number(p.amount), 0);
    const pendingBalance = m.pending_balance ?? Math.max(0, Number(m.price) - totalPaid);
    const daysLeft = getDaysRemaining(m.end_date);
    const isExpired = !m.is_active || m.status === 'EXPIRED' || daysLeft < 0;

    if (pendingBalance > 0) {
      return {
        eventType: 'CREDIT_OVERDUE',
        eventLabel: 'Recordar saldo',
        tooltip: `Recordar saldo pendiente (${formatPrice(pendingBalance)})`,
        contextData: {
          balance_due: formatPrice(pendingBalance),
          membership_name: (m as any).planName || m.membership_plan?.name || 'Membresía',
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
          membership_name: (m as any).planName || m.membership_plan?.name || 'Membresía',
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
          membership_name: (m as any).planName || m.membership_plan?.name || 'Membresía',
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
        membership_name: (m as any).planName || m.membership_plan?.name || 'Membresía',
        expiry_date: formatDate(m.end_date),
      },
    };
  };

  // Agrupación por Cliente: Prioriza la membresía ACTIVA y luego la más reciente
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

      // Ordenar planes del cliente:
      // 1. Activas primero
      // 2. Fecha de vencimiento (end_date) más reciente primero
      // 3. ID más reciente primero
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

  // Contadores dinámicos para las pestañas basados en clientes únicos agrupados
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

  // Filtrado por pestaña y búsqueda sobre los registros agrupados
  const filteredMemberships = useMemo(() => {
    return groupedMemberships.filter((m) => {
      const days = getDaysRemaining(m.end_date);
      const isAct = m.is_active && m.status?.toUpperCase() === 'ACTIVE' && days >= 0;

      // Filtro por pestaña
      if (activeTab === 'ACTIVE' && !isAct) return false;
      if (activeTab === 'EXPIRING' && (!isAct || days > 7)) return false;
      if (activeTab === 'EXPIRED' && isAct) return false;

      // Filtro por texto de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientDisplayName = (m.clientName && m.clientName !== 'Desconocido' ? m.clientName : m.client?.full_name || m.client_name || '');
        const matchClient = clientDisplayName.toLowerCase().includes(q);
        const matchPlan = m.planName?.toLowerCase().includes(q);
        const matchId = String(m.client_id).includes(q) || String(m.id).includes(q);
        const matchTrainer = m.trainer_name?.toLowerCase().includes(q);
        if (!matchClient && !matchPlan && !matchId && !matchTrainer) return false;
      }

      return true;
    });
  }, [groupedMemberships, activeTab, searchQuery]);

  // Paginación
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

  const renderStatus = (status: string, is_active: boolean, end_date: string) => {
    if (!is_active) return <Badge variant="danger">Cancelada</Badge>;
    const days = getDaysRemaining(end_date);
    if (status.toUpperCase() === 'EXPIRED' || days < 0) {
      return <Badge variant="danger">Expirada</Badge>;
    }
    if (days <= 7 && days >= 0) {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertTriangle size={10} />
          Por vencer ({days === 0 ? 'Hoy' : `${days}d`})
        </Badge>
      );
    }
    return <Badge variant="success">Activa</Badge>;
  };

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Sin suscripciones registradas</h3>
        <p className="text-text-secondary max-w-sm text-sm">
          Asigna un plan de membresía a un cliente para comenzar a ver el historial aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Controles: Pestañas de Estado + Buscador */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-panel p-3.5 rounded-[var(--radius-xl)] border border-border-light shadow-subtle">
        {/* Pestañas (Tabs) */}
        <div className="flex items-center gap-1 bg-surface-base p-0.5 rounded-[var(--radius-sm)] border border-border-medium overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => handleTabChange('ALL')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
              activeTab === 'ALL'
                ? "bg-surface-raised text-text-primary shadow-xs font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Todos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              activeTab === 'ALL' ? "bg-white/[0.08] text-text-secondary font-semibold" : "bg-white/[0.03] text-text-muted"
            )}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ACTIVE')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
              activeTab === 'ACTIVE'
                ? "bg-surface-raised text-emerald-400 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Activos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              activeTab === 'ACTIVE' ? "bg-emerald-500/15 text-emerald-400 font-bold" : "bg-white/[0.03] text-text-muted"
            )}>
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRING')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
              activeTab === 'EXPIRING'
                ? "bg-surface-raised text-amber-400 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Clock size={13} className="shrink-0" />
            <span>Por Vencer</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              counts.expiring > 0 ? "bg-amber-500/15 text-amber-400 font-bold" : "bg-white/[0.03] text-text-muted"
            )}>
              {counts.expiring}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRED')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
              activeTab === 'EXPIRED'
                ? "bg-surface-raised text-rose-400 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Vencidos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              counts.expired > 0 ? "bg-rose-500/15 text-rose-400 font-bold" : "bg-white/[0.03] text-text-muted"
            )}>
              {counts.expired}
            </span>
          </button>
        </div>

        {/* Buscador Rápido */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
          <input
            type="text"
            placeholder="Buscar cliente o plan..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-9 pl-9 pr-8 rounded-[var(--radius-sm)] border border-border-medium bg-surface-base text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange({ target: { value: '' } } as any)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contenedor de la Tabla */}
      <div className="w-full overflow-hidden rounded-[var(--radius-xl)] border border-border-light bg-surface-panel shadow-subtle">
        {filteredMemberships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-border-light/40 flex items-center justify-center mb-3 text-text-muted">
              {activeTab === 'EXPIRING' ? (
                <Clock size={22} className="text-warning" />
              ) : activeTab === 'EXPIRED' ? (
                <ShieldAlert size={22} className="text-danger" />
              ) : (
                <Search size={22} />
              )}
            </div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              {activeTab === 'EXPIRING'
                ? 'No hay membresías próximas a vencer en 7 días'
                : activeTab === 'ACTIVE'
                ? 'No hay membresías activas registradas'
                : activeTab === 'EXPIRED'
                ? 'No hay membresías vencidas'
                : 'No se encontraron resultados'}
            </h4>
            <p className="text-xs text-text-muted max-w-sm mb-4">
              {searchQuery
                ? `No se encontraron membresías que coincidan con "${searchQuery}".`
                : 'Selecciona otra pestaña para explorar los demás registros.'}
            </p>
            {(searchQuery || activeTab !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="text-xs font-medium text-brand-primary hover:underline"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
              <thead className="text-xs uppercase bg-surface-raised/70 text-text-muted border-b border-border-subtle tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Cliente</th>
                  <th scope="col" className="px-6 py-3.5">Plan Asignado</th>
                  <th scope="col" className="px-6 py-3.5">Vigencia</th>
                  <th scope="col" className="px-6 py-3.5">Precio Cobrado</th>
                  <th scope="col" className="px-6 py-3.5">Estado</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {paginatedMemberships.map((membership) => (
                  <tr 
                    key={membership.id} 
                    className={cn(
                      "hover:bg-surface-panel-hover transition-colors group",
                      !membership.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-text-primary">
                        {membership.clientName && membership.clientName !== 'Desconocido'
                          ? membership.clientName
                          : membership.client?.full_name || membership.client_name || `Cliente #${membership.client_id}`}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>ID Cliente: {membership.client_id}</span>
                        {membership.historyCount > 1 && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setHistoryModalData({
                                clientName: (membership.clientName && membership.clientName !== 'Desconocido')
                                ? membership.clientName
                                : membership.client?.full_name || membership.client_name || `Cliente #${membership.client_id}`,
                                memberships: membership.history,
                              })}
                              className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-primary-hover hover:underline font-medium cursor-pointer"
                              title={`Ver todos los ${membership.historyCount} planes del cliente`}
                            >
                              <History size={11} />
                              <span>Historial ({membership.historyCount})</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-brand-primary">{membership.planName}</div>
                      {membership.trainer_name && (
                        <div className="text-xs text-text-muted mt-0.5">Entrenador: {membership.trainer_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle2 size={12} />
                          <span>{formatDate(membership.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-rose-400">
                          <Clock size={12} />
                          <span>{formatDate(membership.end_date)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-text-primary">
                      {formatPrice(membership.price)}
                    </td>
                    <td className="px-6 py-3.5">
                      {renderStatus(membership.status, membership.is_active, membership.end_date)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {(() => {
                        const ctx = getMembershipWhatsAppContext(membership);
                        return (
                          <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                    const clientInfo = {
                                      id: membership.client_id,
                                      full_name: (membership.clientName && membership.clientName !== 'Desconocido')
                                        ? membership.clientName
                                        : membership.client?.full_name || membership.client_name || `Cliente #${membership.client_id}`,
                                      phone: membership.client?.phone || null,
                                    };
                                    openWhatsAppModal({
                                      client: clientInfo,
                                      eventType: ctx.eventType,
                                      eventLabel: ctx.eventLabel,
                                      contextData: ctx.contextData,
                                    });
                                  }}
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center justify-center cursor-pointer"
                                  title={ctx.tooltip}
                                >
                                  <MessageCircle size={15} />
                                </button>
                            {membership.historyCount > 1 && (
                              <button
                                type="button"
                                onClick={() => setHistoryModalData({
                                  clientName: (membership.clientName && membership.clientName !== 'Desconocido')
                                  ? membership.clientName
                                  : membership.client?.full_name || membership.client_name || `Cliente #${membership.client_id}`,
                                  memberships: membership.history,
                                })}
                                className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors"
                                title={`Ver Historial (${membership.historyCount} registros)`}
                              >
                                <History size={15} />
                              </button>
                            )}
                            {onViewDetails && (
                              <button
                                onClick={() => onViewDetails(membership)}
                                className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors"
                                title="Ver Detalle"
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => onToggleStatus(membership)}
                              className={cn(
                                "p-1.5 rounded-[var(--radius-sm)] transition-colors",
                                membership.is_active 
                                  ? "text-text-muted hover:text-rose-400 hover:bg-rose-500/10" 
                                  : "text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                              )}
                              title={membership.is_active ? "Cancelar Suscripción" : "Reactivar Suscripción"}
                            >
                              <Ban size={15} />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con Paginación e Información */}
        {filteredMemberships.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 bg-surface-panel/40 border-t border-border-subtle">
            <p className="text-xs text-text-muted text-center sm:text-left">
              Mostrando <span className="font-semibold text-text-primary">{(currentPage - 1) * pageSize + 1}</span> a{' '}
              <span className="font-semibold text-text-primary">
                {Math.min(currentPage * pageSize, filteredMemberships.length)}
              </span>{' '}
              de <span className="font-semibold text-text-primary">{filteredMemberships.length}</span> clientes
            </p>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

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

          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border-subtle bg-surface-panel/40">
            <table className="w-full text-left text-xs text-text-secondary whitespace-nowrap">
              <thead className="bg-surface-raised/70 text-text-muted border-b border-border-subtle uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Vigencia</th>
                  <th className="px-4 py-2.5">Precio Cobrado</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {historyModalData?.memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-panel-hover transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-text-primary">{m.planName}</div>
                      <div className="text-[10px] text-text-muted">ID: #{m.id}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-text-primary">{formatDate(m.start_date)}</div>
                      <div className="text-[11px] text-text-muted">hasta {formatDate(m.end_date)}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">
                      {formatPrice(m.price)}
                    </td>
                    <td className="px-4 py-2.5">
                      {renderStatus(m.status, m.is_active, m.end_date)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(() => {
                        const mCtx = getMembershipWhatsAppContext(m);
                        return (
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
                                className="px-2.5 py-1 text-xs text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors inline-flex items-center gap-1 font-medium"
                                title="Ver Detalle Completo"
                              >
                                <Eye size={13} />
                                <span>Ver</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setHistoryModalData(null)}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-raised hover:bg-surface-panel-hover border border-border-medium rounded-[var(--radius-sm)] transition-colors"
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

