import { FileText, Edit2, Ban } from 'lucide-react';
import type { NotificationTemplate } from '@shared/types/notification';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';

interface TemplatesTableProps {
  templates: NotificationTemplate[];
  onEdit: (template: NotificationTemplate) => void;
  onToggleStatus: (template: NotificationTemplate) => void;
}

export function TemplatesTable({ templates, onEdit, onToggleStatus }: TemplatesTableProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Sin plantillas</h3>
        <p className="text-text-secondary max-w-sm">
          No tienes plantillas configuradas. Las plantillas permiten automatizar los mensajes.
        </p>
      </div>
    );
  }

  const translateEventType = (type: string, customName?: string | null) => {
    if (customName) return `${customName} (Personalizado)`;
    const types: Record<string, string> = {
      'MEMBERSHIP_EXPIRY': 'Vencimiento de Membresía',
      'MEMBERSHIP_SOLD': 'Nueva Membresía',
      'MEMBERSHIP_EXPIRED': 'Membresía Vencida',
      'PAYMENT_RECEIVED': 'Confirmación de Pago',
      'PAYMENT_OVERDUE': 'Aviso de Mora',
      'CREDIT_CREATED': 'Nuevo Crédito',
      'CREDIT_PAYMENT_RECEIVED': 'Abono a Crédito',
      'CREDIT_OVERDUE': 'Crédito Vencido',
      'WELCOME': 'Bienvenida al Gimnasio',
      'GROUP_INVITATION': 'Invitación a Grupo de WhatsApp',
      'GENERAL': 'Aviso General',
    };
    return types[type] || type;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {templates.map(template => (
        <div 
          key={template.id} 
          className={cn(
            "flex flex-col bg-bg-surface border border-border-light rounded-xl p-5 shadow-glass transition-all hover:shadow-glass-large",
            !template.is_active && "opacity-60"
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-semibold text-text-primary text-sm mb-1">
                {translateEventType(template.event_type, template.custom_event_name)}
              </h4>
              {template.description && (
                <p className="text-xs text-text-muted mb-2 line-clamp-1">{template.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-[10px] uppercase">{template.channel}</Badge>
                {template.is_active ? (
                  <Badge variant="success" className="text-[10px]">Activa</Badge>
                ) : (
                  <Badge variant="danger" className="text-[10px]">Inactiva</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(template)}
                className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                title="Editar Plantilla"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => onToggleStatus(template)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  template.is_active 
                    ? "text-text-muted hover:text-danger hover:bg-danger/10" 
                    : "text-text-muted hover:text-success hover:bg-success/10"
                )}
                title={template.is_active ? "Desactivar" : "Reactivar"}
              >
                <Ban size={16} />
              </button>
            </div>
          </div>
          
          <div className="bg-bg-page p-3 rounded-lg border border-border-medium flex-1">
            <p className="text-sm text-text-secondary whitespace-pre-wrap font-mono text-[13px]">
              {template.template_body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
