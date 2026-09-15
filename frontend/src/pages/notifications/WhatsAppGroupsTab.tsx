import { useState, useEffect, useId } from 'react';
import { 
  Users, 
  Plus, 
  ExternalLink, 
  Copy, 
  MessageSquare, 
  Edit2, 
  Check, 
  Link as LinkIcon, 
  AlertCircle 
} from 'lucide-react';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { Modal } from '@shared/ui/Modal';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { whatsappGroupService } from '../../services/whatsappGroupService';
import type { WhatsAppGroup, WhatsAppGroupCreate, WhatsAppGroupUpdate } from '@shared/types/whatsappGroup';

export function WhatsAppGroupsTab() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Group Form Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WhatsAppGroup | null>(null);
  const [formData, setFormData] = useState<WhatsAppGroupCreate>({
    name: '',
    description: '',
    invite_url: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Prepare Group Message Modal state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [activeGroupForMessage, setActiveGroupForMessage] = useState<WhatsAppGroup | null>(null);
  const [groupMessage, setGroupMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const groupTextareaId = useId();

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const data = await whatsappGroupService.getAll();
      setGroups(data);
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudieron cargar los grupos de WhatsApp.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      invite_url: '',
      is_active: true,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (group: WhatsAppGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      invite_url: group.invite_url,
      is_active: group.is_active,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'El nombre del grupo es requerido.';
    }
    if (!formData.invite_url.trim()) {
      errors.invite_url = 'El enlace de invitación es requerido.';
    } else {
      const url = formData.invite_url.trim();
      if (!url.startsWith('https://')) {
        errors.invite_url = 'El enlace debe comenzar con https://';
      } else if (!url.includes('whatsapp.com') && !url.includes('wa.me')) {
        errors.invite_url = 'El enlace debe ser un link de WhatsApp (ej. https://chat.whatsapp.com/...)';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSaving(true);
      if (editingGroup) {
        const updatePayload: WhatsAppGroupUpdate = {
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          invite_url: formData.invite_url.trim(),
          is_active: formData.is_active,
        };
        await whatsappGroupService.update(editingGroup.id, updatePayload);
        toast({ type: 'success', title: 'Grupo Actualizado', message: 'El grupo fue actualizado correctamente.' });
      } else {
        await whatsappGroupService.create({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          invite_url: formData.invite_url.trim(),
          is_active: formData.is_active ?? true,
        });
        toast({ type: 'success', title: 'Grupo Creado', message: 'El grupo de WhatsApp fue registrado exitosamente.' });
      }
      setIsFormModalOpen(false);
      await loadGroups();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast({
        type: 'error',
        title: 'Error al guardar',
        message: typeof detail === 'string' ? detail : 'Ocurrió un error al guardar el grupo.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenGroupLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrepareMessage = (group: WhatsAppGroup) => {
    setActiveGroupForMessage(group);
    setGroupMessage(
      `Hola a todos 👋\n\nLes compartimos un aviso importante de nuestro gimnasio:\n\n[Escribe aquí tu mensaje o novedades]\n\n¡Los esperamos para seguir entrenando! 💪`
    );
    setCopied(false);
    setIsMessageModalOpen(true);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(groupMessage);
      setCopied(true);
      toast({ type: 'info', title: 'Copiado', message: 'Mensaje copiado al portapapeles.' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo copiar el mensaje al portapapeles.' });
    }
  };

  const handleCopyAndOpen = async () => {
    if (!activeGroupForMessage) return;
    try {
      await navigator.clipboard.writeText(groupMessage);
      setCopied(true);
      handleOpenGroupLink(activeGroupForMessage.invite_url);
      toast({
        type: 'success',
        title: 'Mensaje copiado',
        message: 'Mensaje copiado. Pégalo en WhatsApp y pulsa Enviar.',
      });
      setIsMessageModalOpen(false);
    } catch {
      handleOpenGroupLink(activeGroupForMessage.invite_url);
      toast({
        type: 'warning',
        title: 'Grupo Abierto',
        message: 'Grupo abierto en WhatsApp. Recuerda copiar tu mensaje.',
      });
      setIsMessageModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            Grupos de WhatsApp
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Gestiona enlaces oficiales de invitación y prepara mensajes grupales con apertura directa.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 cursor-pointer shadow-md self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nuevo Grupo</span>
        </Button>
      </div>

      {/* Group List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border-light bg-bg-surface/40">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Users size={24} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">No hay grupos de WhatsApp registrados</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Crea grupos de invitación (ej. Jornada Mañana, Reto Fit, Novedades) para asociarlos a clientes y enviar avisos.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenCreate}
            className="mt-4 gap-1.5 text-xs text-emerald-400 border-emerald-500/30"
          >
            <Plus size={14} /> Crear primer grupo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-xl bg-bg-surface border border-border-light hover:border-border-medium transition-all flex flex-col justify-between gap-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Users size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-text-primary truncate" title={group.name}>
                      {group.name}
                    </h3>
                  </div>
                  {group.is_active ? (
                    <Badge variant="success" className="text-xs">Activo</Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">Inactivo</Badge>
                  )}
                </div>

                {group.description && (
                  <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                    {group.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted bg-bg-page px-2.5 py-1.5 rounded-lg border border-border-light truncate">
                  <LinkIcon size={12} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{group.invite_url}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border-light flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(group)}
                  className="text-xs text-text-muted hover:text-text-primary px-2"
                  title="Editar datos del grupo"
                >
                  <Edit2 size={13} />
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePrepareMessage(group)}
                    className="gap-1.5 text-xs text-text-primary hover:text-emerald-400"
                  >
                    <MessageSquare size={13} />
                    <span>Preparar mensaje</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenGroupLink(group.invite_url)}
                    className="gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    title="Abrir enlace de invitación en WhatsApp"
                  >
                    <ExternalLink size={13} />
                    <span>Abrir grupo</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear / Editar Grupo */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingGroup ? 'Editar Grupo de WhatsApp' : 'Nuevo Grupo de WhatsApp'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isLoading={isSaving}
              onClick={handleSaveGroup}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {editingGroup ? 'Guardar Cambios' : 'Registrar Grupo'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Nombre del Grupo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej. Clientes Mañana, Novedades ZonaFit"
              className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              required
            />
            {formErrors.name && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {formErrors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Descripción (Opcional)
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ej. Clientes que asisten en jornada matutina (6:00 AM a 10:00 AM)"
              className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Enlace de Invitación de WhatsApp *
            </label>
            <input
              type="url"
              value={formData.invite_url}
              onChange={(e) => setFormData({ ...formData, invite_url: e.target.value })}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary font-mono text-xs"
              required
            />
            {formErrors.invite_url ? (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {formErrors.invite_url}
              </p>
            ) : (
              <p className="text-[11px] text-text-muted mt-1">
                Obtén este enlace en los ajustes de tu grupo en WhatsApp (Ajustes de grupo → Enlace de invitación).
              </p>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={formData.is_active ?? true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-border-medium bg-bg-surface"
            />
            <span className="text-sm text-text-primary font-medium">Grupo activo</span>
          </label>
        </form>
      </Modal>

      {/* Modal: Preparar Mensaje para Grupo */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={activeGroupForMessage ? `Mensaje para ${activeGroupForMessage.name}` : 'Preparar Mensaje'}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyMessage}
              className="gap-1.5 text-xs text-text-secondary"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado' : 'Copiar mensaje'}</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMessageModalOpen(false)}
              >
                Cerrar
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyAndOpen}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs shadow-md"
              >
                <Copy size={14} />
                <span>Copiar y abrir grupo</span>
                <ExternalLink size={13} />
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-surface-card border border-border-light text-xs text-text-secondary">
            <p className="leading-relaxed">
              Escribe o ajusta el mensaje que deseas enviar al grupo. Al pulsar <strong>"Copiar y abrir grupo"</strong> se copiará al portapapeles y se abrirá el enlace de WhatsApp del grupo para pegarlo y enviarlo.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={groupTextareaId} className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Mensaje grupal
              </label>
              <span className="text-[11px] text-text-muted">
                {groupMessage.length} caracteres
              </span>
            </div>
            <textarea
              id={groupTextareaId}
              rows={7}
              value={groupMessage}
              onChange={(e) => setGroupMessage(e.target.value)}
              className="w-full p-3 bg-bg-surface border border-border-medium rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              placeholder="Escribe el mensaje para el grupo..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
