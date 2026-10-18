import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserPlus,
  Users,
  Activity,
  UserMinus,
  FileSpreadsheet,
  Download,
  Upload,
  X,
  Clock,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useClients, useClientMetrics } from '../../hooks/useClients';
import { ClientsTable } from './ClientsTable';
import { ClientDrawer } from './ClientDrawer';
import { ClientProfileDrawer } from './ClientProfileDrawer';
import { ClientImportModal } from './ClientImportModal';
import { clientService } from '../../services/clientService';
import type { Client } from '@shared/types/client';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { EmptyState } from '@shared/ui/EmptyState';
import { Button } from '@shared/ui/Button';
import { useToast } from '@shared/ui/Toast';
import { Pagination } from '@shared/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '@shared/utils/cn';

type FilterType = 'all' | 'active' | 'expiring_membership' | 'expired_membership' | 'pending_balance' | 'inactive';

export function ClientsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const { toast } = useToast();

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const queryClient = useQueryClient();
  const filterTypeParam = filterType === 'all' ? undefined : filterType;
  const { query, deleteMutation, updateMutation } = useClients(
    page,
    pageSize,
    debouncedSearchTerm,
    undefined,
    filterTypeParam
  );
  const metricsQuery = useClientMetrics();

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
      toast({
        type: 'success',
        title: 'Exportación Exitosa',
        message: 'Se ha descargado el padrón oficial de socios en formato Excel.'
      });
    } catch {
      toast({
        type: 'error',
        title: 'Error de Exportación',
        message: 'No se pudo exportar el listado de clientes.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await clientService.downloadTemplate();
      toast({
        type: 'success',
        title: 'Plantilla Oficial Descargada',
        message: 'Se ha descargado plantilla_clientes_zonafit.xlsx lista para diligenciar.'
      });
    } catch {
      toast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo descargar la plantilla oficial.'
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    setPage(1);
  };

  const data = query.data;
  const clients = data?.items || [];
  const total = data?.total || 0;

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
        toast({
          type: 'warning',
          title: 'Socio Suspendido',
          message: `${client.full_name} ha sido desactivado del padrón activo.`
        });
      } else {
        // Reactivate
        await updateMutation.mutateAsync({ id: client.id, data: { is_active: true } });
        toast({
          type: 'success',
          title: 'Socio Reactivado',
          message: `${client.full_name} vuelve a estar activo.`
        });
      }
    } catch {
      toast({
        type: 'error',
        title: 'Error de Estado',
        message: 'No se pudo cambiar el estado del socio.'
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 relative animate-fade-in">
      {/* Header and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <SectionEyebrow
            index="07"
            label="DIRECTORIO OPERATIVO // CLIENTES"
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary mt-1">
            Directorio de Socios & Clientes
          </h1>
          <p className="text-text-secondary text-sm mt-1 max-w-2xl">
            Padrón unificado con control de identidades, contacto directo por WhatsApp, estados de cuenta y perfiles 360.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="flex items-center gap-1.5 border-border-subtle bg-surface-panel/80 hover:bg-surface-raised text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium"
            title="Descargar plantilla oficial para importación de clientes (.xlsx)"
          >
            <Download size={14} className="text-text-muted" />
            <span className="hidden sm:inline">Plantilla</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 border-border-subtle bg-surface-panel/80 hover:bg-surface-raised text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium"
            title="Exportar todos los clientes del gimnasio a Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} className="text-text-muted" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-medium"
            title="Importar y comparar clientes desde Excel oficial"
          >
            <Upload size={14} />
            <span>Importar Excel</span>
          </Button>

          <ActionGlowButton onClick={handleOpenCreate} className="rounded-xl text-xs font-semibold">
            <UserPlus size={16} />
            <span>Nuevo Socio</span>
          </ActionGlowButton>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Socios */}
        <div className="rounded-2xl border border-border-subtle bg-surface-panel/80 p-4.5 flex items-center gap-4 shadow-subtle backdrop-blur-sm">
          <div className="w-11 h-11 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
            <Users size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Padrón Total</p>
            <h3 className="text-2xl font-bold tracking-tight text-text-primary font-mono mt-0.5">
              {metricsQuery.isLoading && query.isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                metricsQuery.data?.total_clients ?? total
              )}
            </h3>
            <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
              <span className="text-emerald-400">Vigentes: {metricsQuery.data?.active_memberships || 0}</span>
              <span className="text-border-medium">·</span>
              <span className="text-rose-400">Vencidos: {metricsQuery.data?.expired_memberships || 0}</span>
            </div>
          </div>
        </div>

        {/* Activos */}
        <div className="rounded-2xl border border-border-subtle bg-surface-panel/80 p-4.5 flex items-center gap-4 shadow-subtle backdrop-blur-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Cuentas Activas</p>
            <h3 className="text-2xl font-bold tracking-tight text-emerald-400 font-mono mt-0.5">
              {metricsQuery.isLoading ? <Skeleton className="h-7 w-16" /> : (metricsQuery.data?.active_accounts ?? '—')}
            </h3>
          </div>
        </div>

        {/* Inactivos */}
        <div className="rounded-2xl border border-border-subtle bg-surface-panel/80 p-4.5 flex items-center gap-4 shadow-subtle backdrop-blur-sm">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <UserMinus size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Suspendidos</p>
            <h3 className="text-2xl font-bold tracking-tight text-rose-400 font-mono mt-0.5">
              {metricsQuery.isLoading ? <Skeleton className="h-7 w-16" /> : (metricsQuery.data?.inactive_accounts ?? '—')}
            </h3>
          </div>
        </div>
      </div>

      {/* Search and Server Filter Controls */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-surface-panel/90 p-3.5 rounded-2xl border border-border-subtle shadow-subtle backdrop-blur-sm">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, teléfono o correo..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-border-medium bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 transition-all font-sans"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Pills (Integrated with Backend filter_type) */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-surface-base rounded-xl border border-border-subtle custom-scrollbar">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap",
              filterType === 'all'
                ? "bg-surface-raised text-text-primary shadow-xs font-semibold border border-border-subtle"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            Todos
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('active')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap",
              filterType === 'active'
                ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            Activos
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('expiring_membership')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
              filterType === 'expiring_membership'
                ? "bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
                : "text-text-muted hover:text-text-secondary"
            )}
            title="Membresías activas que vencen en los próximos 7 días"
          >
            <Clock size={12} />
            <span>Por Vencer</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('expired_membership')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
              filterType === 'expired_membership'
                ? "bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/30"
                : "text-text-muted hover:text-text-secondary"
            )}
            title="Membresías vencidas"
          >
            <AlertCircle size={12} />
            <span>Vencidos</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('pending_balance')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
              filterType === 'pending_balance'
                ? "bg-indigo-500/15 text-indigo-400 font-semibold border border-indigo-500/30"
                : "text-text-muted hover:text-text-secondary"
            )}
            title="Socios con deudas o saldos pendientes en CxC"
          >
            <CreditCard size={12} />
            <span>Con Deuda</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('inactive')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap",
              filterType === 'inactive'
                ? "bg-surface-raised text-rose-400 font-semibold border border-border-subtle"
                : "text-text-muted hover:text-text-secondary"
            )}
            title="Cuentas suspendidas o inactivas"
          >
            Suspendidos
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {query.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : query.isError ? (
        <div className="mt-4">
          <ErrorState
            title="No se pudieron cargar los socios"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </div>
      ) : clients.length === 0 && !searchTerm && filterType === 'all' ? (
        <div className="mt-4">
          <EmptyState
            icon={<Users size={32} />}
            title="No hay socios registrados en el gimnasio"
            description="Comienza construyendo el padrón de afiliados registrando tu primer socio o importando desde Excel."
            action={
              <ActionGlowButton onClick={handleOpenCreate}>
                <UserPlus size={16} className="mr-2" />
                <span>Nuevo Socio</span>
              </ActionGlowButton>
            }
          />
        </div>
      ) : clients.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Search size={32} />}
            title="Sin coincidencias encontradas"
            description={
              searchTerm
                ? `No hay socios que coincidan con "${searchTerm}".`
                : `No se encontraron socios bajo el filtro "${filterType}".`
            }
            action={
              <Button
                variant="outline"
                onClick={() => { setSearchTerm(''); setFilterType('all'); setPage(1); }}
                className="rounded-xl text-xs"
              >
                Limpiar Filtros y Búsqueda
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Data Table */}
          <ClientsTable
            clients={clients}
            onViewProfile={handleOpenProfile}
            onEdit={handleOpenEdit}
            onToggleStatus={handleToggleStatus}
          />

          {/* Pagination */}
          {data && data.total_pages > 1 && (
            <div className="mt-2 flex justify-center">
              <Pagination
                page={data.page}
                totalPages={data.total_pages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Slide-over Drawer for Create / Edit */}
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
        onRenewClick={(client, planId) => {
          setIsProfileOpen(false);
          setSelectedClient(null);
          navigate('/memberships', {
            state: {
              renewClientId: client.id,
              renewPlanId: planId,
            },
          });
        }}
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
