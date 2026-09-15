import { useState } from 'react';
import { Search, UserPlus, Users, Activity, UserMinus, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useClients } from '../../hooks/useClients';
import { ClientsTable } from './ClientsTable';
import { ClientDrawer } from './ClientDrawer';
import { ClientProfileDrawer } from './ClientProfileDrawer';
import { ClientImportModal } from './ClientImportModal';
import { clientService } from '../../services/clientService';
import type { Client } from '@shared/types/client';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { EmptyState } from '@shared/ui/EmptyState';
import { Button } from '@shared/ui/Button';
import { useToast } from '@shared/ui/Toast';

import { Pagination } from '@shared/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '@shared/utils/cn';

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { toast } = useToast();
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const isActiveParam = statusFilter === 'all' ? undefined : statusFilter === 'active';
  
  const queryClient = useQueryClient();
  const { query, deleteMutation, updateMutation } = useClients(page, pageSize, debouncedSearchTerm, isActiveParam);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // For Edit/Create
  const [isProfileOpen, setIsProfileOpen] = useState(false); // For 360 View
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await clientService.exportClients();
      toast({ type: 'success', title: 'Exportación Exitosa', message: 'Se ha descargado el listado oficial de clientes.' });
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo exportar el listado de clientes.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await clientService.downloadTemplate();
      toast({ type: 'success', title: 'Plantilla Descargada', message: 'Se ha descargado la plantilla oficial.' });
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo descargar la plantilla.' });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

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
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="flex items-center gap-1.5"
            title="Descargar plantilla oficial para importación de clientes"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Descargar plantilla</span>
            <span className="sm:hidden">Plantilla</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5"
            title="Exportar todos los clientes del gimnasio a Excel"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Exportar clientes</span>
            <span className="sm:hidden">Exportar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10"
            title="Importar y comparar clientes desde Excel"
          >
            <Upload size={15} />
            <span>Importar / actualizar</span>
          </Button>

          <ActionGlowButton onClick={handleOpenCreate}>
            <UserPlus size={18} />
            <span>Nuevo Cliente</span>
          </ActionGlowButton>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border-light bg-bg-surface/40 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <Users size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Total Clientes</p>
            <h3 className="text-2xl font-bold text-text-primary">{total}</h3>
          </div>
        </div>
        
        <div className="rounded-xl border border-border-light bg-bg-surface/40 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Activos</p>
            <h3 className="text-2xl font-bold text-text-primary">{activeCount}</h3>
          </div>
        </div>

        <div className="rounded-xl border border-border-light bg-bg-surface/40 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
            <UserMinus size={24} />
          </div>
          <div>
            <p className="text-text-muted text-sm font-medium">Inactivos</p>
            <h3 className="text-2xl font-bold text-text-primary">{inactiveCount}</h3>
          </div>
        </div>
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-bg-page p-1 rounded-lg border border-border-medium w-full md:w-auto justify-center">
            <button
              onClick={() => { setStatusFilter('all'); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === 'all' 
                  ? "bg-bg-elevated text-text-primary shadow-sm" 
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => { setStatusFilter('active'); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === 'active' 
                  ? "bg-bg-elevated text-success shadow-sm" 
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              Activos
            </button>
            <button
              onClick={() => { setStatusFilter('inactive'); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === 'inactive' 
                  ? "bg-bg-elevated text-danger shadow-sm" 
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              Inactivos
            </button>
          </div>
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

      {/* Excel Import & Comparison Modal */}
      <ClientImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
        }}
      />
    </div>
  );
}
