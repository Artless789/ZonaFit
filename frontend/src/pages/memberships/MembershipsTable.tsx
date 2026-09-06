import { useState, useMemo } from 'react';
import { Ban, CheckCircle2, UserCheck, Clock, Eye, Search, AlertTriangle, X, ShieldAlert, History } from 'lucide-react';
import type { Membership } from '@shared/types/membership';
import { Badge } from '@shared/ui/Badge';
import { Modal } from '@shared/ui/Modal';
import { Pagination } from '@shared/ui/Pagination';
import { cn } from '@shared/utils/cn';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { formatCurrency } from '@shared/utils/formatters';

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
        const matchClient = m.clientName?.toLowerCase().includes(q);
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-bg-surface p-3 sm:p-4 rounded-xl border border-border-light shadow-glass">
        {/* Pestañas (Tabs) */}
        <div className="flex items-center gap-1 bg-bg-page p-1 rounded-xl border border-border-medium overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => handleTabChange('ALL')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'ALL'
                ? "bg-bg-elevated text-text-primary shadow-xs border border-border-medium font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Todos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              activeTab === 'ALL' ? "bg-bg-surface text-text-primary" : "bg-bg-surface/50 text-text-muted"
            )}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ACTIVE')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'ACTIVE'
                ? "bg-bg-elevated text-success shadow-xs border border-border-medium font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Activos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              activeTab === 'ACTIVE' ? "bg-success/20 text-success font-bold" : "bg-bg-surface/50 text-text-muted"
            )}>
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRING')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'EXPIRING'
                ? "bg-bg-elevated text-warning shadow-xs border border-border-medium font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Clock size={13} className="shrink-0" />
            <span>Por Vencer</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              counts.expiring > 0 ? "bg-warning/20 text-warning font-bold" : "bg-bg-surface/50 text-text-muted"
            )}>
              {counts.expiring}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('EXPIRED')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'EXPIRED'
                ? "bg-bg-elevated text-danger shadow-xs border border-border-medium font-semibold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>Vencidos</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full",
              counts.expired > 0 ? "bg-danger/20 text-danger font-bold" : "bg-bg-surface/50 text-text-muted"
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
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-border-medium bg-bg-page text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary transition-fast"
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
      <div className="w-full overflow-hidden rounded-xl border border-border-light bg-bg-surface shadow-glass">
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
              <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Cliente</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Plan Asignado</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Vigencia</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Precio Cobrado</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Estado</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {paginatedMemberships.map((membership) => (
                  <tr 
                    key={membership.id} 
                    className={cn(
                      "hover:bg-bg-elevated/30 transition-colors group",
                      !membership.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-text-primary">{membership.clientName}</div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>ID Cliente: {membership.client_id}</span>
                        {membership.historyCount > 1 && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setHistoryModalData({
                                clientName: membership.clientName,
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
                        <div className="flex items-center gap-1.5 text-xs text-success">
                          <CheckCircle2 size={12} />
                          <span>{formatDate(membership.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-danger">
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
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {membership.historyCount > 1 && (
                          <button
                            type="button"
                            onClick={() => setHistoryModalData({
                              clientName: membership.clientName,
                              memberships: membership.history,
                            })}
                            className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                            title={`Ver Historial (${membership.historyCount} registros)`}
                          >
                            <History size={16} />
                          </button>
                        )}
                        {onViewDetails && (
                          <button
                            onClick={() => onViewDetails(membership)}
                            className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                            title="Ver Detalle"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onToggleStatus(membership)}
                          className={cn(
                            "p-2 rounded-md transition-colors",
                            membership.is_active 
                              ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                              : "text-text-muted hover:text-success hover:bg-success/10"
                          )}
                          title={membership.is_active ? "Cancelar Suscripción" : "Reactivar Suscripción"}
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con Paginación e Información */}
        {filteredMemberships.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3 bg-bg-elevated/30 border-t border-border-light">
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

          <div className="overflow-x-auto rounded-xl border border-border-light">
            <table className="w-full text-left text-xs text-text-secondary whitespace-nowrap">
              <thead className="bg-bg-elevated/50 text-text-muted border-b border-border-light uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 font-semibold">Vigencia</th>
                  <th className="px-4 py-2.5 font-semibold">Precio Cobrado</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {historyModalData?.memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-bg-elevated/30 transition-colors">
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
                      {onViewDetails && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryModalData(null);
                            onViewDetails(m);
                          }}
                          className="px-2.5 py-1 text-xs text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors inline-flex items-center gap-1 font-medium"
                          title="Ver Detalle Completo"
                        >
                          <Eye size={13} />
                          <span>Ver</span>
                        </button>
                      )}
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
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-elevated border border-border-medium rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

