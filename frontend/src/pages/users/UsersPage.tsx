// @ts-nocheck
import { Select, SelectItem } from '../../components/shared/Select';
import React, { useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import {
  Title,
  Text,
  TextInput,
  Flex
} from '@tremor/react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { UserDrawer } from './UserDrawer';
import type { User } from '../../types/user';
import { GlassCard } from '../../components/shared/GlassCard';
import { Button } from '../../components/shared/Button';
import { Badge } from '../../components/shared/Badge';

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
          <Title className="text-2xl font-bold text-text-primary">Usuarios y Personal</Title>
          <Text className="text-text-secondary">Administra los accesos y roles del personal del gimnasio.</Text>
        </div>
        <Button onClick={handleCreate}>
          <PlusIcon className="w-4 h-4 mr-2 inline-block"/> Nuevo Usuario
        </Button>
      </div>

      <GlassCard className="p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:max-w-xs">
          <TextInput
            icon={MagnifyingGlassIcon}
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
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
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
                  <td colSpan={5} className="px-4 py-3 text-sm text-center text-text-muted py-4">Cargando usuarios...</td>
                </tr>
              ) : usersQuery.data?.items.map((user) => (
                <tr key={user.id} className="hover:bg-bg-surface/40 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-text-primary">{user.full_name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{user.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={user.role === 'OWNER' ? 'purple' : user.role === 'ADMIN' ? 'info' : 'neutral'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={user.is_active ? 'success' : 'danger'}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>Editar</Button>
                  </td>
                </tr>
              ))}
              {usersQuery.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm text-center py-4 text-text-muted">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <UserDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={selectedUser}
      />
    </div>
  );
};
