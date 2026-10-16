import { useState, useMemo } from 'react';
import {
  RotateCcw,
  MessageCircle,
  Search,
  X,
  AlertOctagon,
  Calendar,
} from 'lucide-react';
import { Modal } from '@shared/ui/Modal';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import { useMemberships } from '../../hooks/useMemberships';
import { useWhatsAppWeb } from '../../hooks/useWhatsAppWeb';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { parseISO } from 'date-fns';

export interface ExpiredMembershipCardItem {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone?: string | null;
  clientPhotoUrl?: string | null;
  clientDocument?: string | null;
  planId?: number;
  planName: string;
  price: number;
  endDate: string;
  daysElapsed: number;
}

interface ExpiredMembershipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenew: (item: ExpiredMembershipCardItem) => void;
  items?: ExpiredMembershipCardItem[];
}

const initials = (name?: string) =>
  (name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function ExpiredMembershipsModal({
  isOpen,
  onClose,
  onRenew,
  items,
}: ExpiredMembershipsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();
  const { query: membershipsQuery } = useMemberships();

  // If items prop is provided, use it; otherwise compute from memberships query
  const allExpiredItems: ExpiredMembershipCardItem[] = useMemo(() => {
    if (items && items.length > 0) {
      return items;
    }

    const rawList =
      (Array.isArray(membershipsQuery.data)
        ? membershipsQuery.data
        : membershipsQuery.data?.items) || [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const result: ExpiredMembershipCardItem[] = [];

    for (const m of rawList) {
      try {
        const end = parseISO(m.end_date);
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        const diffDays = Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
        const isExp = !m.is_active || m.status?.toUpperCase() === 'EXPIRED' || diffDays < 0;

        if (isExp) {
          result.push({
            id: m.id,
            clientId: m.client_id || m.client?.id || 0,
            clientName: m.client?.full_name || m.client_name || 'Desconocido',
            clientPhone: m.client?.phone || null,
            clientPhotoUrl: m.client?.photo_url || null,
            clientDocument: m.client
              ? `${m.client.document_type || ''} ${m.client.document || ''}`.trim()
              : null,
            planId: m.membership_plan_id || m.membership_plan?.id,
            planName: m.membership_plan?.name || m.plan_name || 'Membresía',
            price: Number(m.price || m.membership_plan?.price || 0),
            endDate: m.end_date,
            daysElapsed: Math.max(0, -diffDays),
          });
        }
      } catch {
        // Skip invalid date
      }
    }

    return result.sort((a, b) => a.daysElapsed - b.daysElapsed);
  }, [items, membershipsQuery.data]);

  // Filtered by search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return allExpiredItems;
    const q = searchTerm.toLowerCase();
    return allExpiredItems.filter(
      (item) =>
        item.clientName.toLowerCase().includes(q) ||
        (item.clientDocument && item.clientDocument.toLowerCase().includes(q)) ||
        (item.clientPhone && item.clientPhone.includes(q)) ||
        item.planName.toLowerCase().includes(q)
    );
  }, [allExpiredItems, searchTerm]);

  const handleOpenWhatsApp = (item: ExpiredMembershipCardItem) => {
    openWhatsAppModal({
      client: {
        id: item.clientId,
        full_name: item.clientName,
        phone: item.clientPhone || null,
      },
      eventType: 'MEMBERSHIP_EXPIRED',
      eventLabel: 'Avisar vencida',
      contextData: {
        membership_name: item.planName,
        expiry_date: item.endDate ? formatDate(item.endDate) : '',
        days_overdue: item.daysElapsed.toString(),
      },
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        containerClassName="max-w-6xl w-full"
        className="bg-[#121214] border-white/10"
        title="Membresías Vencidas"
        description={
          <span className="flex items-center gap-2 text-xs font-mono text-text-muted mt-0.5">
            <span className="text-rose-400 font-semibold">
              {allExpiredItems.length} {allExpiredItems.length === 1 ? 'membresía vencida' : 'membresías vencidas'}
            </span>
            <span>·</span>
            <span>Atención prioritaria y recuperación de cartera</span>
          </span>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Top Controls: Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Buscar por socio, documento o plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-9 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 transition-all font-sans"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <span className="font-mono text-xs text-text-muted self-end sm:self-center">
              Mostrando {filteredItems.length} de {allExpiredItems.length}
            </span>
          </div>

          {/* Card Grid */}
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <AlertOctagon className="mx-auto h-10 w-10 text-emerald-400/50 mb-3" />
              <p className="text-base font-semibold text-text-primary">
                {searchTerm ? 'No se encontraron resultados' : '¡Sin membresías vencidas!'}
              </p>
              <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                  : 'Todos los socios cuentan con cobertura activa en este momento.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredItems.map((item) => {
                const daysBadge =
                  item.daysElapsed === 0
                    ? 'Venció hoy'
                    : `Venció hace ${item.daysElapsed} ${item.daysElapsed === 1 ? 'día' : 'días'}`;

                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#16161a]/90 hover:border-white/20 hover:bg-[#1a1a20] p-4.5 transition-all shadow-subtle"
                  >
                    {/* Top Section */}
                    <div className="flex flex-col gap-3.5">
                      {/* Avatar and Identity */}
                      <div className="flex items-start gap-3">
                        {item.clientPhotoUrl ? (
                          <AuthorizedImage
                            src={item.clientPhotoUrl}
                            alt={item.clientName}
                            className="size-12 rounded-full object-cover border border-white/15 shrink-0"
                            fallback={
                              <div className="size-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center font-mono text-xs font-semibold text-text-secondary shrink-0">
                                {initials(item.clientName)}
                              </div>
                            }
                          />
                        ) : (
                          <div className="size-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center font-mono text-xs font-semibold text-text-secondary shrink-0">
                            {initials(item.clientName)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-sm font-semibold text-text-primary truncate"
                            title={item.clientName}
                          >
                            {item.clientName}
                          </h4>
                          {item.clientDocument && (
                            <p className="font-mono text-[11px] text-text-muted truncate">
                              {item.clientDocument}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-text-muted truncate">
                            {item.clientPhone || 'Sin teléfono'}
                          </p>
                        </div>
                      </div>

                      {/* Plan and Overdue Badge */}
                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                        <span
                          className="text-xs font-medium text-text-secondary truncate max-w-[140px]"
                          title={item.planName}
                        >
                          {item.planName}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide border border-rose-500/30 bg-rose-500/10 text-rose-300 shrink-0">
                          {daysBadge}
                        </span>
                      </div>

                      {/* Expiry Date and Cost */}
                      <div className="flex items-baseline justify-between gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-text-muted">
                          <Calendar size={12} className="shrink-0" />
                          <span className="font-mono text-[11px]">
                            Venció: {formatDate(item.endDate)}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-text-primary">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-white/5">
                      {/* Renovar ahora button with green glow */}
                      <button
                        type="button"
                        onClick={() => {
                          onRenew(item);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
                        title="Renovar membresía inmediatamente"
                      >
                        <RotateCcw size={13} className="shrink-0" />
                        <span>Renovar</span>
                      </button>

                      {/* Recordar pago button with WhatsApp icon */}
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(item)}
                        className="flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-black border border-sky-500/30 shadow-[0_0_12px_rgba(14,165,233,0.15)] hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all cursor-pointer"
                        title="Enviar recordatorio formal por WhatsApp"
                      >
                        <MessageCircle size={13} className="shrink-0" />
                        <span>Recordar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* WhatsApp message composer */}
      <WhatsAppModalComponent />
    </>
  );
}
