import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '@shared/ui/GlassPanel';
import { Input } from '@shared/ui/Input';
import { Avatar } from '@shared/ui/Avatar';
import { Badge } from '@shared/ui/Badge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { authService } from '../../services/authService';
import { api } from '../../services/api';
import { 
  User as UserIcon, 
  Mail, 
  KeyRound, 
  CheckCircle2, 
  Building,
  Send
} from 'lucide-react';

export function UserProfileTab() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  const isProfileDirty = 
    fullName.trim() !== (user?.full_name || '').trim() ||
    email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!fullName.trim() || fullName.trim().length < 2) {
      toast({
        type: 'warning',
        title: 'Nombre requerido',
        message: 'El nombre debe tener al menos 2 caracteres.',
      });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast({
        type: 'warning',
        title: 'Correo inválido',
        message: 'Ingresa un correo electrónico válido.',
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await api.put(`/users/${user.id}`, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });

      if (refreshProfile) {
        await refreshProfile();
      }

      toast({
        type: 'success',
        title: 'Perfil Actualizado',
        message: 'Los datos de tu cuenta de operador se actualizaron correctamente.',
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const msg = errorObj.response?.data?.detail || 'No se pudo actualizar el perfil.';
      toast({
        type: 'error',
        title: 'Error al actualizar',
        message: typeof msg === 'string' ? msg : 'Revisa los campos e intenta nuevamente.',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;

    setIsSendingReset(true);
    try {
      await authService.forgotPassword(user.email);
      setResetSentSuccess(true);
      toast({
        type: 'success',
        title: 'Enlace enviado',
        message: `Hemos enviado el enlace de restablecimiento a ${user.email}`,
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const msg = errorObj.response?.data?.detail || 'No se pudo enviar el correo de recuperación.';
      toast({
        type: 'error',
        title: 'Error al enviar enlace',
        message: typeof msg === 'string' ? msg : 'Intenta nuevamente más tarde.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const roleLabel = 
    user?.role === 'OWNER' ? 'Propietario / Fundador' :
    user?.role === 'ADMIN' ? 'Administrador de Sede' :
    user?.role === 'SUPERADMIN' ? 'Superadministrador Global' :
    'Operador / Personal';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Panel 1: Perfil de Operador */}
      <GlassPanel
        index="01"
        eyebrow="CUENTA DE OPERADOR"
        title="Mi Perfil de Usuario"
        description="Información de la cuenta con la que te encuentras autenticado en esta sesión de trabajo."
        rounded="2xl"
        padding="md"
      >
        {/* User Identity Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border-medium bg-surface-raised/40">
          <div className="flex items-center gap-4">
            <Avatar
              fallback={user?.full_name?.substring(0, 2).toUpperCase() || 'OP'}
              className="size-14 text-base font-bold border-2 border-brand-primary/40 shadow-sm"
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  {user?.full_name || 'Operador'}
                </h3>
                <Badge 
                  variant={user?.role === 'OWNER' ? 'warning' : 'neutral'}
                  className="font-mono text-[10px] uppercase tracking-wider"
                >
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary flex items-center gap-1.5">
                <Mail size={13} className="text-text-muted" />
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border-light bg-surface-base/60 text-xs font-mono text-text-muted">
            <Building size={14} className="text-brand-primary" />
            <span>Gimnasio ID #{user?.gym_id || 'Global'}</span>
          </div>
        </div>

        {/* Edit Profile Form */}
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Nombre Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              leftIcon={<UserIcon size={16} className="text-text-muted" />}
              helperText="Nombre visible en reportes, bitácora de auditoría y navbar."
            />

            <Input
              label="Correo Electrónico de Acceso"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@zonafit.com"
              leftIcon={<Mail size={16} className="text-text-muted" />}
              helperText="Utilizado para inicio de sesión y notificaciones de seguridad."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {isProfileDirty && (
              <button
                type="button"
                onClick={() => {
                  setFullName(user?.full_name || '');
                  setEmail(user?.email || '');
                }}
                className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Revertir cambios
              </button>
            )}

            <ActionGlowButton
              type="submit"
              disabled={!isProfileDirty || isUpdatingProfile}
              isLoading={isUpdatingProfile}
            >
              Guardar Perfil
            </ActionGlowButton>
          </div>
        </form>
      </GlassPanel>

      {/* Panel 2: Seguridad y Contraseña */}
      <GlassPanel
        index="02"
        eyebrow="CREDENCIALES Y ACCESO"
        title="Seguridad y Cambio de Contraseña"
        description="Por políticas de seguridad, el cambio de contraseña se gestiona mediante un enlace seguro enviado a tu correo institucional."
        rounded="2xl"
        padding="md"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border-light bg-surface-raised/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-light flex items-center justify-center shrink-0 mt-0.5">
              <KeyRound size={20} className="text-brand-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-text-primary">
                Restablecer Contraseña de Acceso
              </p>
              <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                Se enviará un correo a <strong className="text-text-primary">{user?.email}</strong> con un enlace único de un solo uso que expirará en 15 minutos para actualizar tu clave de forma segura.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendPasswordReset}
            disabled={isSendingReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-medium hover:border-brand-primary/50 bg-surface-raised hover:bg-brand-primary/10 text-xs font-mono uppercase tracking-wider text-text-primary transition-all duration-200 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Send size={14} className="text-brand-primary" />
            <span>{isSendingReset ? 'Enviando...' : 'Enviar enlace a mi correo'}</span>
          </button>
        </div>

        {resetSentSuccess && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-xs animate-in fade-in duration-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>
              Enlace enviado. Revisa tu bandeja de entrada o carpeta de spam y sigue las instrucciones para establecer tu nueva clave.
            </span>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
