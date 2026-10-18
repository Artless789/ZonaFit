import { CheckCircle2, Ban, Eye, Edit2, MessageCircle } from 'lucide-react';
import type { Client } from '@shared/types/client';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { cn } from '@shared/utils/cn';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';

interface ClientsTableProps {
  clients: Client[];
  onViewProfile?: (client: Client) => void;
  onEdit: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
}

const formatDateSafe = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return format(d, 'dd MMM yyyy', { locale: es });
  } catch {
    return dateStr;
  }
};

export function ClientsTable({ clients, onViewProfile, onEdit, onToggleStatus }: ClientsTableProps) {
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb(
    (clientId) => {
      const target = clients.find((c) => c.id === clientId);
      if (target) onEdit(target);
    }
  );

  const handleProfileClick = (client: Client) => {
    if (onViewProfile) {
      onViewProfile(client);
    } else {
      onEdit(client);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface-panel/60 rounded-2xl border border-border-subtle border-dashed backdrop-blur-sm">
        <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl flex items-center justify-center mb-3 text-brand-primary shadow-subtle">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="text-base font-semibold text-text-primary tracking-tight mb-1">
          No hay socios registrados
        </h3>
        <p className="text-text-secondary text-xs max-w-sm">
          No se encontraron clientes para los filtros aplicados. Puedes agregar un nuevo socio o modificar la búsqueda.
        </p>
      </div>
    );
  }

  return (
    <>
      <TableContainer className="rounded-2xl border border-border-subtle bg-surface-panel/80 backdrop-blur-sm shadow-subtle overflow-hidden">
        <Table>
          <TableHeader className="bg-surface-raised/60 border-b border-border-subtle">
            <TableRow>
              <TableHead className="w-[26%] text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5">
                Socio / Identidad
              </TableHead>
              <TableHead className="w-[14%] text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5">
                Documento
              </TableHead>
              <TableHead className="w-[24%] text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5">
                Membresía
              </TableHead>
              <TableHead className="w-[16%] text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5">
                Contacto
              </TableHead>
              <TableHead className="w-[10%] text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5">
                Estado Cuenta
              </TableHead>
              <TableHead className="w-[10%] text-right text-xs font-semibold text-text-muted uppercase tracking-wider py-3.5 pr-5">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border-subtle">
            {clients.map((client) => (
              <TableRow
                key={client.id}
                className="hover:bg-surface-raised/40 transition-colors group"
              >
                {/* Socio / Identidad */}
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => handleProfileClick(client)}
                      className="relative h-10 w-10 rounded-xl bg-surface-base border border-border-medium text-brand-primary font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs shadow-inner cursor-pointer hover:border-brand-primary/50 transition-colors group/avatar"
                      title="Ver Perfil 360"
                    >
                      {client.photo_url ? (
                        <AuthorizedImage
                          src={client.photo_url}
                          alt={client.full_name}
                          className="w-full h-full object-cover group-hover/avatar:scale-105 transition-transform"
                        />
                      ) : (
                        <span className="text-sm font-semibold tracking-wider text-text-secondary group-hover/avatar:text-brand-primary">
                          {client.full_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => handleProfileClick(client)}
                        className="font-semibold text-text-primary text-sm leading-tight hover:text-brand-primary transition-colors text-left truncate max-w-[200px] block cursor-pointer"
                        title={client.full_name}
                      >
                        {client.full_name}
                      </button>
                      <div className="text-xs text-text-muted truncate max-w-[200px] mt-0.5 font-mono">
                        {client.email || 'Sin correo registrado'}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Documento */}
                <TableCell className="py-3.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-base border border-border-subtle font-mono text-xs text-text-secondary">
                    <span className="font-semibold text-text-muted">{client.document_type}</span>
                    <span className="text-text-primary">{client.document}</span>
                  </div>
                </TableCell>

                {/* Membresía */}
                <TableCell className="py-3.5">
                  {client.current_membership ? (
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-medium text-xs text-text-primary truncate max-w-[140px]"
                          title={client.current_membership.plan_name}
                        >
                          {client.current_membership.plan_name}
                        </span>
                        {client.current_membership.status === 'ACTIVE' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Vigente
                          </span>
                        )}
                        {client.current_membership.status === 'EXPIRED' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Vencida
                          </span>
                        )}
                        {client.current_membership.status === 'FUTURE' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Programada
                          </span>
                        )}
                        {client.current_membership.status === 'CANCELLED' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Cancelada
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-text-muted flex items-center gap-1">
                        {client.current_membership.status === 'ACTIVE' && (
                          <span>
                            Vence: {formatDateSafe(client.current_membership.end_date)} ({client.current_membership.days_left}d)
                          </span>
                        )}
                        {client.current_membership.status === 'EXPIRED' && (
                          <span className="text-rose-400/90 font-medium">
                            Venció: {formatDateSafe(client.current_membership.end_date)} (hace {Math.abs(client.current_membership.days_left)}d)
                          </span>
                        )}
                        {client.current_membership.status === 'FUTURE' && (
                          <span className="text-amber-400/90 font-medium">
                            Inicia: {formatDateSafe(client.current_membership.start_date)}
                          </span>
                        )}
                        {client.current_membership.status === 'CANCELLED' && (
                          <span className="text-zinc-500">
                            Finalizada el {formatDateSafe(client.current_membership.end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : client.has_membership_history ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-amber-400/80">Historial previo</span>
                      <span className="text-[10px] text-text-muted">Sin plan actual</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-raised text-text-muted border border-border-subtle">
                      Sin membresía
                    </span>
                  )}
                </TableCell>

                {/* Contacto */}
                <TableCell className="py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-text-primary">
                      {client.phone}
                    </span>
                    {client.whatsapp_group_name ? (
                      <span className="text-[11px] text-emerald-400 font-medium truncate max-w-[140px]" title={client.whatsapp_group_name}>
                        Grupo: {client.whatsapp_group_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-muted">
                        {client.whatsapp_opt_in ? 'WhatsApp habilitado' : 'Sin WhatsApp opt-in'}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Estado de Cuenta */}
                <TableCell className="py-3.5">
                  {client.is_active ? (
                    <StatusBadge status="active" label="Cuenta Activa" />
                  ) : (
                    <StatusBadge status="neutral" label="Suspendido" />
                  )}
                </TableCell>

                {/* Acciones */}
                <TableCell className="text-right py-3.5 pr-5">
                  <div className="flex items-center justify-end gap-1 opacity-90 sm:opacity-70 group-hover:opacity-100 transition-opacity">
                    {/* Contactar por WhatsApp */}
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsAppModal({
                          client: {
                            id: client.id,
                            full_name: client.full_name,
                            phone: client.phone,
                          },
                          eventType: 'GENERAL',
                          eventLabel: 'Contactar por WhatsApp',
                        })
                      }
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-500/20"
                      title="Contactar por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>

                    {/* Perfil 360 */}
                    <button
                      type="button"
                      onClick={() => handleProfileClick(client)}
                      className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-brand-primary/20"
                      title="Ver Perfil 360"
                    >
                      <Eye size={15} />
                    </button>

                    {/* Editar */}
                    <button
                      type="button"
                      onClick={() => onEdit(client)}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors cursor-pointer border border-transparent hover:border-border-subtle"
                      title="Editar Datos del Socio"
                    >
                      <Edit2 size={15} />
                    </button>

                    {/* Suspender / Reactivar */}
                    <button
                      type="button"
                      onClick={() => onToggleStatus(client)}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors cursor-pointer border border-transparent',
                        client.is_active
                          ? 'text-text-muted hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20'
                          : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                      )}
                      title={client.is_active ? 'Suspender Socio' : 'Reactivar Socio'}
                    >
                      <Ban size={15} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <WhatsAppModalComponent />
    </>
  );
}
