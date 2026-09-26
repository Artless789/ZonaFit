import { CheckCircle2, Ban, Eye, MessageCircle } from 'lucide-react';
import type { Client } from '@shared/types/client';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
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
  onEdit: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
}

export function ClientsTable({ clients, onEdit, onToggleStatus }: ClientsTableProps) {
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb(
    (clientId) => {
      const target = clients.find((c) => c.id === clientId);
      if (target) onEdit(target);
    }
  );

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface-panel rounded-[var(--radius-xl)] border border-border-medium border-dashed">
        <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mb-3 text-brand-primary">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">No hay clientes registrados</h3>
        <p className="text-text-secondary text-xs max-w-sm">
          Aún no tienes clientes en tu base de datos. Comienza agregando uno nuevo.
        </p>
      </div>
    );
  }

  return (
    <>
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-surface-raised border border-border-medium text-brand-primary font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs">
                      {client.photo_url ? (
                        <AuthorizedImage
                          src={client.photo_url}
                          alt={client.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        client.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary leading-tight">{client.full_name}</div>
                      <div className="text-xs text-text-muted mt-0.5">{client.email || 'Sin correo registrado'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-muted">{client.document_type}</span>{' '}
                  <span className="text-text-primary">{client.document}</span>
                </TableCell>
                <TableCell className="text-text-secondary font-mono text-xs">
                  {client.phone}
                </TableCell>
                <TableCell>
                  {client.is_active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="danger">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                      title="Contactar por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(client)}
                      className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                      title="Ver Perfil 360"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(client)}
                      className={cn(
                        'p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer',
                        client.is_active
                          ? 'text-text-muted hover:text-rose-400 hover:bg-rose-500/10'
                          : 'text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'
                      )}
                      title={client.is_active ? 'Suspender Cliente' : 'Reactivar Cliente'}
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
