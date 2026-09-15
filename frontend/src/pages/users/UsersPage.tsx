import { Select, SelectItem } from '@shared/ui/Select';
import { useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { Search, Plus, Shield, ShieldCheck, UserCheck } from 'lucide-react';
import { UserDrawer } from './UserDrawer';
import type { User } from '@shared/types/user';
import { Input } from '@shared/ui/Input';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';

export const UsersPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { usersQuery } = useUsers(
    100,
    0,
    search,
    statusFilter === 'all' ? undefined : statusFilter,
    'full_name',
    false
  );

  const handleCreate = () => {
    setSelectedUser(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Usuarios y Personal</h1>
          <p className="text-sm text-text-secondary">Administra los accesos y roles del personal del gimnasio.</p>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus size={16} /> Nuevo Usuario
        </Button>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:max-w-xs">
          <Input
            leftIcon={<Search size={16} className="text-text-muted" />}
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:max-w-xs">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </Select>
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-0 overflow-hidden">
        <div className="overflow-x-auto rounded-xl border border-border-medium">
          <table className="w-full">
            <thead className="bg-bg-surface/80 border-b border-border-medium">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Correo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-center text-text-muted">Cargando usuarios...</td>
                </tr>
              ) : usersQuery.data?.items.map((user) => (
                <tr key={user.id} className="hover:bg-bg-surface/40 transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 border border-brand-primary/25 text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {user.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <span className="text-sm font-semibold text-text-primary">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-text-secondary">{user.email}</td>
                  <td className="px-4 py-3.5 text-sm">
                    {user.role === 'OWNER' ? (
                      <Badge variant="warning" className="text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>PROPIETARIO</span>
                      </Badge>
                    ) : user.role === 'ADMIN' ? (
                      <Badge variant="default" className="text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                        <span>ADMINISTRADOR</span>
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1">
                        <UserCheck className="w-3.5 h-3.5 text-text-muted" />
                        <span>EMPLEADO</span>
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    <Badge variant={user.is_active ? 'success' : 'danger'} className="text-xs">
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>Editar</Button>
                  </td>
                </tr>
              ))}
              {usersQuery.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-center text-text-muted">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={selectedUser}
      />
    </div>
  );
};
