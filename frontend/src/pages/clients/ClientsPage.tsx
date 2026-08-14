import { useState } from 'react';
import { Search, UserPlus, Users, Activity, UserMinus } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { ClientsTable } from './ClientsTable';
import { ClientDrawer } from './ClientDrawer';
import { ClientProfileDrawer } from './ClientProfileDrawer';
import type { Client } from '../../types/client';
import { GlassCard } from '../../components/shared/GlassCard';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { Skeleton } from '../../components/shared/Skeleton';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../components/shared/Toast';

import { Pagination } from '../../components/shared/Pagination';
import { useDebounce } from '../../hooks/useDebounce';

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const { query, deleteMutation, updateMutation } = useClients(page, pageSize, debouncedSearchTerm);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // For Edit/Create
  const [isProfileOpen, setIsProfileOpen] = useState(false); // For 360 View
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Reset page when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const data = query.data;
  const clients = data?.items || [];
  const total = data?.total || 0;
  
  const activeCount = clients.filter(c => c.is_active).length;
  const inactiveCount = clients.length - activeCount;

  const handleOpenCreate = () => {
    setSelectedClient(null);
    setIsProfileOpen(false);
    setIsDrawerOpen(true);
  };

  const handleOpenProfile = (client: Client) => {
    setSelectedClient(client);
    setIsDrawerOpen(false);
    setIsProfileOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setIsProfileOpen(false);
    setIsDrawerOpen(true);
  };

  const handleToggleStatus = async (client: Client) => {
    try {
      if (client.is_active) {
        // Soft delete (suspend)
        await deleteMutation.mutateAsync(client.id);
        toast({ type: 'warning', title: 'Cliente Suspendido', message: `${client.full_name} ha sido desactivado.` });
      } else {
        // Reactivate
        await updateMutation.mutateAsync({ id: client.id, data: { is_active: true } });
        toast({ type: 'success', title: 'Cliente Reactivado', message: `${client.full_name} vuelve a estar activo.` });
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado del cliente.' });
    }
  };

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 relative">
      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Gestión de Clientes</h1>
          <p className="text-text-secondary text-sm mt-1">
            Administra el padrón de afiliados de tu gimnasio.
          </p>
        </div>
        
        <ActionGlowButton onClick={handleOpenCreate}>
          <UserPlus size={18} />
          <span>Nuevo Cliente</span>
        </ActionGlowButton>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <Users size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Total Clientes</p>
            <h3 className="text-2xl font-bold text-text-primary">{total}</h3>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Activos</p>
            <h3 className="text-2xl font-bold text-text-primary">{activeCount}</h3>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
            <UserMinus size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Inactivos</p>
            <h3 className="text-2xl font-bold text-text-primary">{inactiveCount}</h3>
          </div>
        </GlassCard>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-bg-surface p-4 rounded-xl border border-border-light shadow-glass">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, documento o correo..." 
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-border-medium bg-bg-page text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary transition-fast"
          />
        </div>
      </div>

      {/* Error State */}
      {query.isError ? (
        <div className="mt-8">
          <ErrorState 
            title="No pudimos cargar los clientes" 
            error={query.error} 
            onRetry={() => query.refetch()} 
          />
        </div>
      ) : clients.length === 0 && !query.isLoading && !searchTerm ? (
        <div className="mt-8">
          <EmptyState 
            icon={<Users size={32} />}
            title="No hay clientes registrados"
            description="Todavía no has registrado clientes en tu gimnasio. Comienza agregando tu primer cliente."
            action={
              <ActionGlowButton onClick={handleOpenCreate}>
                <UserPlus size={18} className="mr-2" />
                <span>Nuevo Cliente</span>
              </ActionGlowButton>
            }
          />
        </div>
      ) : (
        <>
          {/* Data Table */}
          {clients.length === 0 && searchTerm ? (
            <div className="mt-8">
              <EmptyState 
                icon={<Search size={32} />}
                title="No se encontraron resultados"
                description={`No hay clientes que coincidan con "${searchTerm}".`}
                action={
                  <Button variant="outline" onClick={() => { setSearchTerm(''); setPage(1); }}>
                    Limpiar Búsqueda
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <ClientsTable 
                clients={clients} 
                onEdit={handleOpenProfile} 
                onToggleStatus={handleToggleStatus} 
              />
              {data && (
                <Pagination 
                  page={data.page} 
                  totalPages={data.total_pages} 
                  onPageChange={setPage} 
                />
              )}
            </>
          )}
        </>
      )}

      {/* Slide-over Drawer for Create/Edit */}
      <ClientDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => { setIsDrawerOpen(false); setSelectedClient(null); }} 
        client={selectedClient} 
      />

      {/* Slide-over Profile Drawer (360) */}
      <ClientProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => { setIsProfileOpen(false); setSelectedClient(null); }}
        clientId={selectedClient?.id}
        onEditClick={handleOpenEdit}
      />
    </div>
  );
}
