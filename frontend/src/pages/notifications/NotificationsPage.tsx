import { useState } from 'react';
import { MessageSquare, LayoutTemplate, Send, Plus, AlertTriangle, CheckCircle2, Wifi, Phone } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useClients } from '../../hooks/useClients';
import { HistoryTable } from './HistoryTable';
import { TemplatesTable } from './TemplatesTable';
import { ManualDrawer } from './ManualDrawer';
import { TemplateDrawer } from './TemplateDrawer';
import { WhatsAppSettingsTab } from './WhatsAppSettingsTab';
import type { NotificationTemplate } from '@shared/types/notification';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

export function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'history' | 'templates' | 'whatsapp'>('history');

  // Queries
  const notificationsQuery = useNotifications();
  const clientsQuery = useClients();

  const history = notificationsQuery.historyQuery.data?.items || [];
  const templates = notificationsQuery.templatesQuery.data?.items || [];
  const clients = clientsQuery.query.data?.items || [];
  const waStatus = notificationsQuery.whatsAppStatusQuery.data;

  // UI States
  const [isManualDrawerOpen, setIsManualDrawerOpen] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

  const handleEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setIsTemplateDrawerOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateDrawerOpen(true);
  };

  const handleToggleTemplateStatus = async (template: NotificationTemplate) => {
    try {
      await notificationsQuery.updateTemplateMutation.mutateAsync({
        id: template.id,
        data: { is_active: !template.is_active },
      });
      toast({ type: 'success', title: 'Plantilla Actualizada', message: template.is_active ? 'Plantilla desactivada.' : 'Plantilla activada.' });
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo actualizar la plantilla.' });
    }
  };

  // Loading — only show skeleton on initial load, NOT on tab switches
  const isInitialLoading =
    notificationsQuery.historyQuery.isLoading ||
    notificationsQuery.templatesQuery.isLoading ||
    clientsQuery.query.isLoading;

  return (
    <div className="flex flex-col gap-6 pb-12 relative animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Comunicaciones</h1>
          <p className="text-text-secondary text-sm mt-1">
            Historial de mensajes WhatsApp y gestión de plantillas automáticas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'templates' && (
            <button
              onClick={handleNewTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
            >
              <Plus size={16} /> Nueva Plantilla
            </button>
          )}
          <ActionGlowButton onClick={() => setIsManualDrawerOpen(true)}>
            <Send size={18} />
            <span>Mensaje Manual</span>
          </ActionGlowButton>
        </div>
      </div>

      {/* WhatsApp Status Banner */}
      {waStatus && (
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border text-sm',
            waStatus.configured
              ? 'bg-success/5 border-success/20 text-success'
              : 'bg-warning/5 border-warning/20 text-warning'
          )}
        >
          <div className="flex items-start gap-3">
            {waStatus.configured ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Wifi size={14} /> WhatsApp Business Cloud API
              </p>
              <p className="text-text-secondary text-xs mt-0.5">{waStatus.message}</p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={cn(
              'self-start sm:self-center px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0',
              waStatus.configured
                ? 'border-success/30 text-success hover:bg-success/10'
                : 'bg-warning text-zinc-950 font-bold hover:bg-warning/90'
            )}
          >
            {waStatus.configured ? 'Gestionar Conexión' : 'Conectar WhatsApp'}
          </button>
        </div>
      )}

      {/* Segmented Control / Tabs */}
      <div className="bg-bg-surface border border-border-light p-1 rounded-xl shadow-glass w-full max-w-lg flex relative">
        <div
          className="absolute inset-y-1 rounded-lg bg-bg-elevated border border-border-medium shadow-sm transition-all duration-300 ease-out z-0"
          style={{
            width: 'calc(33.333% - 4px)',
            left:
              activeTab === 'history'
                ? '4px'
                : activeTab === 'templates'
                ? 'calc(33.333% + 2px)'
                : 'calc(66.666%)',
          }}
        />

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
            activeTab === 'history' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <MessageSquare size={16} />
          <span>Historial</span>
          {history.length > 0 && (
            <span className="ml-1 bg-brand-primary/20 text-brand-primary text-xs rounded-full px-1.5 py-0.5 font-semibold">
              {history.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
            activeTab === 'templates' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <LayoutTemplate size={16} />
          <span>Plantillas</span>
          {templates.length > 0 && (
            <span className="ml-1 bg-bg-elevated text-text-secondary text-xs rounded-full px-1.5 py-0.5 font-semibold border border-border-medium">
              {templates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
            activeTab === 'whatsapp' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Phone size={16} />
          <span>WhatsApp Business</span>
          {waStatus?.configured && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {isInitialLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : activeTab === 'history' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <HistoryTable
              notifications={history}
              clients={clients}
            />
          </div>
        ) : activeTab === 'templates' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <TemplatesTable
              templates={templates}
              onEdit={handleEditTemplate}
              onToggleStatus={handleToggleTemplateStatus}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WhatsAppSettingsTab
              onStatusChanged={() => notificationsQuery.whatsAppStatusQuery.refetch()}
            />
          </div>
        )}
      </div>

      {/* Drawers */}
      <ManualDrawer
        isOpen={isManualDrawerOpen}
        onClose={() => setIsManualDrawerOpen(false)}
        clients={clients}
      />

      <TemplateDrawer
        isOpen={isTemplateDrawerOpen}
        onClose={() => {
          setIsTemplateDrawerOpen(false);
          setEditingTemplate(null);
        }}
        editingTemplate={editingTemplate}
      />
    </div>
  );
}
