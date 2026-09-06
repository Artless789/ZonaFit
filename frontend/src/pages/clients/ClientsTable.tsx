import { CheckCircle2, Ban, Eye } from 'lucide-react';
import type { Client } from '@shared/types/client';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';

interface ClientsTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
}

export function ClientsTable({ clients, onEdit, onToggleStatus }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No hay clientes registrados</h3>
        <p className="text-text-secondary max-w-sm">
          Aún no tienes clientes en tu base de datos. Comienza agregando uno nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Cliente</th>
            <th scope="col" className="px-6 py-4 font-semibold">Documento</th>
            <th scope="col" className="px-6 py-4 font-semibold">Contacto</th>
            <th scope="col" className="px-6 py-4 font-semibold">Estado</th>
            <th scope="col" className="px-6 py-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {clients.map((client) => (
            <tr 
              key={client.id} 
              className="hover:bg-bg-elevated/30 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-bg-elevated border border-border-medium text-brand-primary font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {client.photo_url ? (
                      <AuthorizedImage src={client.photo_url} alt={client.full_name} className="w-full h-full object-cover" />
                    ) : (
                      client.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary">{client.full_name}</div>
                    <div className="text-xs text-text-muted">{client.email || 'Sin correo'}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="font-medium">{client.document_type}</span> {client.document}
              </td>
              <td className="px-6 py-4">
                {client.phone}
              </td>
              <td className="px-6 py-4">
                {client.is_active ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(client)}
                    className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                    title="Ver Perfil 360"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => onToggleStatus(client)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      client.is_active 
                        ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                        : "text-text-muted hover:text-success hover:bg-success/10"
                    )}
                    title={client.is_active ? "Suspender Cliente" : "Reactivar Cliente"}
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
  );
}
