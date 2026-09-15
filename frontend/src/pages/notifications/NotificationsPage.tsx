import { useState } from 'react';
import { MessageSquare, LayoutTemplate, Plus, MessageCircle, Users } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useClients } from '../../hooks/useClients';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { HistoryTable } from './HistoryTable';
import { TemplatesTable } from './TemplatesTable';
import { WhatsAppGroupsTab } from './WhatsAppGroupsTab';
import { ManualDrawer } from './ManualDrawer';
import { TemplateDrawer } from './TemplateDrawer';
import type { NotificationTemplate } from '@shared/types/notification';
import type { Client } from '@shared/types/client';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

export function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'history' | 'templates' | 'groups'>('history');

  // Queries
  const notificationsQuery = useNotifications();
  const clientsQuery = useClients();

  const history = notificationsQuery.historyQuery.data?.items || [];
  const templates = notificationsQuery.templatesQuery.data?.items || [];
  const clients = clientsQuery.query.data?.items || [];

  // WhatsApp Centralized Hook
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

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
      toast({
        type: 'success',
        title: 'Plantilla Actualizada',
        message: template.is_active ? 'Plantilla desactivada.' : 'Plantilla activada.',
      });
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo actualizar la plantilla.' });
    }
  };

  const handlePrepareMessage = (client: Client, eventType: string) => {
    openWhatsAppModal({
      client: {
        id: client.id,
        full_name: client.full_name,
        phone: client.phone || null,
      },
      eventType,
    });
  };

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
            Historial de interacciones de WhatsApp, plantillas oficiales y gestión de grupos de difusión.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'templates' && (
            <button
              onClick={handleNewTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={16} /> Nueva Plantilla
            </button>
          )}
          <ActionGlowButton
            onClick={() => setIsManualDrawerOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 cursor-pointer shadow-md"
          >
            <MessageCircle size={18} />
            <span>Nuevo Mensaje</span>
          </ActionGlowButton>
        </div>
      </div>

      {/* WhatsApp Web Explanation Banner */}
      <div className="flex items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-text-primary text-sm shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-text-primary flex items-center gap-2">
              WhatsApp Web
              <span className="text-[11px] font-normal text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Directo & Seguro
              </span>
            </p>
            <p className="text-text-secondary text-xs mt-0.5 max-w-3xl leading-relaxed">
              Envía mensajes a tus clientes desde tu propio WhatsApp. ZonaFit prepara el mensaje y abre la conversación para que puedas revisarlo y enviarlo con un solo clic.
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-bg-surface border border-border-light p-1 rounded-xl shadow-glass w-full max-w-md flex relative gap-1">
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all cursor-pointer',
            activeTab === 'history' ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-medium' : 'text-text-muted hover:text-text-secondary'
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
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all cursor-pointer',
            activeTab === 'templates' ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-medium' : 'text-text-muted hover:text-text-secondary'
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
          onClick={() => setActiveTab('groups')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all cursor-pointer',
            activeTab === 'groups' ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-medium' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Users size={16} />
          <span>Grupos</span>
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
            <HistoryTable notifications={history} clients={clients} />
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
            <WhatsAppGroupsTab />
          </div>
        )}
      </div>

      {/* Drawers and Modals */}
      <ManualDrawer
        isOpen={isManualDrawerOpen}
        onClose={() => setIsManualDrawerOpen(false)}
        clients={clients}
        onPrepareMessage={handlePrepareMessage}
      />

      <TemplateDrawer
        isOpen={isTemplateDrawerOpen}
        onClose={() => {
          setIsTemplateDrawerOpen(false);
          setEditingTemplate(null);
        }}
        editingTemplate={editingTemplate}
      />

      <WhatsAppModalComponent />
    </div>
  );
}
