import { MessageCircle, XCircle, Clock } from 'lucide-react';
import type { Notification } from '@shared/types/notification';
import type { Client } from '@shared/types/client';
import { Badge } from '@shared/ui/Badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';


interface HistoryTableProps {
  notifications: Notification[];
  clients: Client[];
}

export function HistoryTable({ notifications, clients }: HistoryTableProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Sin notificaciones</h3>
        <p className="text-text-secondary max-w-sm">
          Aún no se han enviado notificaciones a través de WhatsApp.
        </p>
      </div>
    );
  }

  const getClientName = (clientId?: number | null) => {
    if (!clientId) return 'N/A';
    const client = clients.find(c => c.id === clientId);
    return client ? client.full_name : `ID: ${clientId}`;
  };

  const renderStatus = (status: string, channel?: string, error?: string | null) => {
    const s = (status || '').toUpperCase();
    if (s === 'OPENED' || channel === 'WHATSAPP_WEB' || s === 'SENT' || s === 'DELIVERED') {
      return (
        <Badge variant="success" className="flex items-center gap-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
          <MessageCircle size={12} className="text-emerald-400" />
          <span>Abierto en WhatsApp</span>
        </Badge>
      );
    }
    if (s === 'FAILED') {
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="danger" className="flex items-center gap-1"><XCircle size={12}/> Falló</Badge>
          {error && <span className="text-[10px] text-danger max-w-37.5 truncate" title={error}>{error}</span>}
        </div>
      );
    }
    return <Badge variant="warning" className="flex items-center gap-1"><Clock size={12}/> Pendiente</Badge>;
  };

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d MMM, yyyy - HH:mm", { locale: es });
    } catch {
      return isoString;
    }
  };

  const translateEventType = (type: string) => {
    const types: Record<string, string> = {
      'MEMBERSHIP_EXPIRY': 'Vencimiento',
      'MEMBERSHIP_EXPIRED': 'Vencida',
      'PAYMENT_RECEIVED': 'Pago Recibido',
      'CREDIT_OVERDUE': 'Saldo Pendiente',
      'WELCOME': 'Bienvenida',
      'GENERAL': 'General',
    };
    return types[type] || type;
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
        <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Fecha</th>
            <th scope="col" className="px-6 py-4 font-semibold">Destinatario</th>
            <th scope="col" className="px-6 py-4 font-semibold">Canal</th>
            <th scope="col" className="px-6 py-4 font-semibold">Motivo</th>
            <th scope="col" className="px-6 py-4 font-semibold">Mensaje</th>
            <th scope="col" className="px-6 py-4 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {notifications.map((notif) => (
            <tr key={notif.id} className="hover:bg-bg-elevated/30 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-text-primary">{formatDate(notif.created_at)}</span>
              </td>
              <td className="px-6 py-4">
                <div className="font-medium text-text-primary">{getClientName(notif.client_id)}</div>
                <div className="text-xs text-text-muted font-mono">{notif.recipient}</div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                  <MessageCircle size={13} />
                  WhatsApp Web
                </span>
              </td>
              <td className="px-6 py-4">
                <Badge variant="default" className="bg-bg-page border-border-medium">
                  {translateEventType(notif.event_type)}
                </Badge>
              </td>
              <td className="px-6 py-4 max-w-xs">
                <div className="truncate text-text-secondary" title={notif.message_body}>
                  {notif.message_body}
                </div>
              </td>
              <td className="px-6 py-4">
                {renderStatus(notif.status, notif.channel, notif.error_detail)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
