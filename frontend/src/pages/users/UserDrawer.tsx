import { Select, SelectItem } from '@shared/ui/Select';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@shared/ui/Button';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { useToast } from '@shared/ui/Toast';
import { useUsers } from '../../hooks/useUsers';
import type { User } from '@shared/types/user';
import { useAuth } from '../../context/AuthContext';

const userSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Correo inválido'),
  role: z.enum(['ADMIN', 'STAFF'], {
    message: 'Selecciona un rol válido'
  }),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserDrawer = ({ isOpen, onClose, user }: UserDrawerProps) => {
  const { toast } = useToast();
  const { createUser, updateUser } = useUsers();
  const { user: currentUser } = useAuth();
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'STAFF',
      password: '',
      is_active: true,
    },
  });

  const watchRole = watch('role');
  const watchIsActive = watch('is_active');

  useEffect(() => {
    if (user) {
      setValue('full_name', user.full_name);
      setValue('email', user.email);
      setValue('role', (user.role === 'ADMIN' || user.role === 'STAFF') ? user.role : 'STAFF');
      setValue('is_active', user.is_active);
      setValue('password', '');
    } else {
      reset({
        full_name: '',
        email: '',
        role: 'STAFF',
        password: '',
        is_active: true,
      });
    }
  }, [user, isOpen, setValue, reset]);

  const onSubmit = async (data: UserFormValues) => {
    try {
      if (isEditing) {
        if (!user) return;
        await updateUser.mutateAsync({
          id: user.id,
          user: {
            full_name: data.full_name,
            email: data.email,
            role: data.role,
            is_active: data.is_active,
          }
        });
        toast({ type: 'success', title: 'Usuario Actualizado', message: 'Datos guardados correctamente.' });
      } else {
        if (!data.password) {
          toast({ type: 'error', title: 'Error', message: 'La contraseña es requerida para usuarios nuevos.' });
          return;
        }
        await createUser.mutateAsync({
          full_name: data.full_name,
          email: data.email,
          role: data.role,
          password: data.password,
        });
        toast({ type: 'success', title: 'Usuario Creado', message: 'El usuario fue creado exitosamente.' });
      }
      onClose();
    } catch (error: any) {
      toast({ type: 'error', title: 'Error', message: error.response?.data?.detail || 'Ocurrió un error al guardar' });
    }
  };

  const isOwnerOrSuper = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPERADMIN';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
      noPadding
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          
          {/* Notificación si intenta editar a alguien superior */}
          {isEditing && user && (user.role === 'OWNER' || user.role === 'SUPERADMIN') && (
            <div className="bg-warning/10 text-warning p-4 rounded-md text-sm">
              Este usuario es un {user.role}. No puedes editar su información desde este portal.
            </div>
          )}

          <div className="space-y-1">
            <Input
              label="Nombre Completo *"
              {...register('full_name')}
              error={!!errors.full_name}
              helperText={errors.full_name?.message}
              placeholder="Ej. Carlos Díaz"
              disabled={isEditing && user ? (user.role === 'OWNER' || user.role === 'SUPERADMIN') : false}
            />
          </div>

          <div className="space-y-1">
            <Input
              label="Correo Electrónico *"
              {...register('email')}
              type="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              placeholder="carlos@ejemplo.com"
              disabled={isEditing && user ? (user.role === 'OWNER' || user.role === 'SUPERADMIN') : false}
            />
          </div>

          {!isEditing && (
            <div className="space-y-1">
              <Input
                label="Contraseña *"
                {...register('password')}
                type="password"
                error={!!errors.password}
                helperText={errors.password?.message || 'El usuario podrá cambiarla después usando "Recuperar contraseña".'}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">
              Rol <span className="text-danger">*</span>
            </label>
            <Select value={watchRole} 
              onValueChange={(val) => setValue('role', val as any)}
              disabled={isEditing && user ? (user.role === 'OWNER' || user.role === 'SUPERADMIN') : false}
            >
              <SelectItem value="STAFF">STAFF (Personal Base)</SelectItem>
              {isOwnerOrSuper && (
                <SelectItem value="ADMIN">ADMIN (Administrador Sede)</SelectItem>
              )}
            </Select>
            {errors.role && <p className="text-danger text-sm mt-1">{errors.role.message}</p>}
            {!isOwnerOrSuper && (
              <p className="text-xs text-text-muted mt-1">Solo los propietarios pueden designar nuevos administradores.</p>
            )}

            <div className="p-3 rounded-lg bg-bg-surface border border-border-light text-xs space-y-1 mt-2">
              <span className="font-semibold text-text-primary block">
                {watchRole === 'ADMIN' ? 'Permisos de Administrador (Sede):' : 'Permisos de Personal (Staff):'}
              </span>
              {watchRole === 'ADMIN' ? (
                <p className="text-text-muted leading-relaxed">
                  Acceso a membresías, ventas POS, inventarios, reportes de caja y comunicaciones.
                </p>
              ) : (
                <p className="text-text-muted leading-relaxed">
                  Atención en mostrador, registro de clientes, ventas en punto de venta y mensajes a clientes.
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="space-y-1 border-t border-border-light pt-4 mt-4">
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Estado del Usuario
              </label>
              
              <Select value={watchIsActive ? 'active' : 'inactive'} 
                onValueChange={(val) => setValue('is_active', val === 'active')}
                disabled={isEditing && user ? (user.role === 'OWNER' || user.role === 'SUPERADMIN' || String(currentUser?.id) === String(user.id)) : false}
              >
                <SelectItem value="active">Activo (Puede iniciar sesión)</SelectItem>
                <SelectItem value="inactive">Inactivo (No puede iniciar sesión)</SelectItem>
              </Select>
              
              {user && String(currentUser?.id) === String(user.id) && (
                <p className="text-xs text-warning mt-1">No puedes desactivar tu propia cuenta.</p>
              )}
            </div>
          )}
          
        </div>

        <div className="flex-shrink-0 border-t border-border-light px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-6 flex justify-end gap-3 bg-bg-surface/60">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            type="submit"
            disabled={createUser.isPending || updateUser.isPending || (isEditing && user ? (user.role === 'OWNER' || user.role === 'SUPERADMIN') : false)}
          >
            {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
