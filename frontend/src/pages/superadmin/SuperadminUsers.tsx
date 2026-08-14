import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Users } from 'lucide-react';
import { GlassCard } from '../../components/shared/GlassCard';
import { Skeleton } from '../../components/shared/Skeleton';
import { Pagination } from '../../components/shared/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '../../components/shared/Badge';

export function SuperadminUsers() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-users', { page, pageSize }],
    queryFn: () => superadminService.getUsers(page, pageSize),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <GlassCard className="p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">No se pudieron cargar los usuarios.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Usuarios Globales</h1>
        <p className="text-text-secondary text-sm mt-1">Directorio global de usuarios registrados en el sistema.</p>
      </div>

      <GlassCard className="overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Users className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No hay usuarios</h3>
            <p className="text-sm text-text-secondary">Aún no se ha registrado ningún usuario.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Usuario</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Rol</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Gym ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">#{user.id}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-text-primary">{user.full_name}</p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role === 'SUPERADMIN' ? 'info' : 'default'}>{user.role}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {user.gym_id ? `#${user.gym_id}` : 'Global'}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="danger">Inactivo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="border-t border-white/5 p-4 flex justify-center bg-white/[0.01]">
            <Pagination
              page={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </GlassCard>
    </div>
  );
}
