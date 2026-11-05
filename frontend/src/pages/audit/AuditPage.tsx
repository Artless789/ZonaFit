import { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  X,
  Calendar,
  Layers,
  User,
  Activity,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { Select, SelectItem } from '@shared/ui/Select';
import { Input } from '@shared/ui/Input';
import { Button } from '@shared/ui/Button';
import { Skeleton } from '@shared/ui/Skeleton';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { useUsers } from '../../hooks/useUsers';
import { useDebounce } from '../../hooks/useDebounce';
import { AuditTable } from './AuditTable';
import { AuditDetailDrawer } from './AuditDetailDrawer';
import type { AuditLog } from '@shared/types/audit';

export function AuditPage() {
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [module, setModule] = useState<string>('ALL');
  const [action, setAction] = useState<string>('ALL');
  const [userId, setUserId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Log for Forensic Drawer
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const debouncedSearch = useDebounce(searchTerm, 350);

  // Fetch users for the employee filter dropdown
  const { usersQuery } = useUsers(100, 0);
  const gymUsers = usersQuery.data?.items || [];

  // Fetch Audit Logs with server-side pagination and filters
  const { query } = useAuditLogs({
    page,
    page_size: pageSize,
    module: module === 'ALL' ? undefined : module,
    action: action === 'ALL' ? undefined : action,
    user_id: userId !== 'ALL' && userId ? parseInt(userId, 10) : undefined,
    search: debouncedSearch.trim() || undefined,
    start_date: startDate ? `${startDate}T00:00:00` : undefined,
    end_date: endDate ? `${endDate}T23:59:59` : undefined,
  });

  const logs = query.data?.items || [];
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, query.data?.total_pages || Math.ceil(total / pageSize));
  const isLoading = query.isLoading;
  const isFetching = query.isFetching;

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    module !== 'ALL' ||
    action !== 'ALL' ||
    userId !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const handleResetFilters = () => {
    setSearchTerm('');
    setModule('ALL');
    setAction('ALL');
    setUserId('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLog = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                Auditoría y Trazabilidad de Operaciones
              </h1>
              <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
                Bitácora forense e inmutable de movimientos, transacciones y cambios realizados por el personal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Lock size={12} />
            <span>Registro Inmutable Activo</span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border-light bg-bg-surface shadow-glass">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Eventos</span>
            <Activity size={16} className="text-brand-primary" />
          </div>
          <p className="text-2xl font-bold text-text-primary font-mono">
            {isLoading ? '...' : total.toLocaleString('es-CO')}
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">Registros históricos</span>
        </div>

        <div className="p-4 rounded-xl border border-border-light bg-bg-surface shadow-glass">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Módulos Auditados</span>
            <Layers size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-text-primary font-mono">9 Módulos</p>
          <span className="text-[11px] text-text-muted mt-1 block">Cobertura 100% integral</span>
        </div>

        <div className="p-4 rounded-xl border border-border-light bg-bg-surface shadow-glass">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Personal Registrado</span>
            <User size={16} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-text-primary font-mono">
            {gymUsers.length} Usuarios
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">Operadores monitoreados</span>
        </div>

        <div className="p-4 rounded-xl border border-border-light bg-bg-surface shadow-glass">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Filtros Activos</span>
            <Filter size={16} className={hasActiveFilters ? 'text-brand-primary' : 'text-text-muted'} />
          </div>
          <p className="text-2xl font-bold text-text-primary font-mono">
            {hasActiveFilters ? 'Personalizados' : 'Todos'}
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">
            {hasActiveFilters ? `${logs.length} en esta vista` : 'Sin restricciones'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border-light bg-bg-surface p-4 sm:p-5 shadow-glass flex flex-col gap-4">
        {/* Top Search Input & Fast Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por empleado, cliente, producto, acción o ID..."
              className="pl-10 h-10 text-xs sm:text-sm bg-bg-elevated/40 border-border-light focus:border-brand-primary"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-10 text-xs text-rose-400 border-rose-500/20 hover:bg-rose-500/10 gap-1.5 shrink-0"
            >
              <RotateCcw size={13} />
              Limpiar Filtros
            </Button>
          )}
        </div>

        {/* Detailed Dropdowns & Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border-light/60">
          {/* Módulo */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">
              Módulo Afectado
            </label>
            <Select
              value={module}
              onValueChange={(val) => {
                setModule(val);
                setPage(1);
              }}
            >
              <SelectItem value="ALL">Todos los módulos</SelectItem>
              <SelectItem value="MEMBERSHIPS">Membresías</SelectItem>
              <SelectItem value="CLIENTS">Clientes</SelectItem>
              <SelectItem value="SALES">Ventas (POS)</SelectItem>
              <SelectItem value="PAYMENTS">Pagos</SelectItem>
              <SelectItem value="INVENTORY">Inventario & Productos</SelectItem>
              <SelectItem value="CASH_REGISTER">Caja Registradora</SelectItem>
              <SelectItem value="SETTINGS">Configuración del Gimnasio</SelectItem>
              <SelectItem value="USERS">Usuarios y Personal</SelectItem>
              <SelectItem value="AUTH">Autenticación (Sesiones)</SelectItem>
            </Select>
          </div>

          {/* Tipo de Acción */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">
              Tipo de Acción
            </label>
            <Select
              value={action}
              onValueChange={(val) => {
                setAction(val);
                setPage(1);
              }}
            >
              <SelectItem value="ALL">Todas las acciones</SelectItem>
              <SelectItem value="CREATE">Creación General</SelectItem>
              <SelectItem value="UPDATE">Modificación General</SelectItem>
              <SelectItem value="DELETE">Eliminación / Desactivación</SelectItem>
              <SelectItem value="MEMBERSHIP_CREATED">Membresía Asignada</SelectItem>
              <SelectItem value="MEMBERSHIP_RENEWED">Membresía Renovada</SelectItem>
              <SelectItem value="MEMBERSHIP_CANCELLED">Membresía Cancelada</SelectItem>
              <SelectItem value="SALE_COMPLETED">Venta POS Completada</SelectItem>
              <SelectItem value="SALE_CANCELLED">Venta Cancelada</SelectItem>
              <SelectItem value="PAYMENT_CREATED">Pago Registrado</SelectItem>
              <SelectItem value="PAYMENT_CANCELLED">Pago Cancelado</SelectItem>
              <SelectItem value="CASH_REGISTER_OPENED">Apertura de Caja</SelectItem>
              <SelectItem value="CASH_REGISTER_CLOSED">Cierre de Caja</SelectItem>
              <SelectItem value="CASH_REGISTER_MOVEMENT">Movimiento de Caja</SelectItem>
              <SelectItem value="INVENTORY_MOVEMENT">Movimiento de Inventario</SelectItem>
              <SelectItem value="LOGIN">Inicio de Sesión</SelectItem>
              <SelectItem value="LOGOUT">Cierre de Sesión</SelectItem>
              <SelectItem value="USER_CREATED">Usuario Creado</SelectItem>
              <SelectItem value="ROLE_CHANGED">Cambio de Rol</SelectItem>
              <SelectItem value="GYM_SETTINGS_UPDATED">Ajustes del Gimnasio</SelectItem>
            </Select>
          </div>

          {/* Empleado / Operador */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">
              Operador / Empleado
            </label>
            <Select
              value={userId}
              onValueChange={(val) => {
                setUserId(val);
                setPage(1);
              }}
            >
              <SelectItem value="ALL">Todos los empleados</SelectItem>
              {gymUsers.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.full_name || u.email} (#{u.id})
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Rango de Fechas */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 block flex items-center gap-1">
              <Calendar size={12} className="text-brand-primary" />
              Rango de Fechas
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                title="Fecha Desde"
                className="w-full h-10 px-2 text-xs bg-bg-elevated/40 border border-border-light rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-brand-primary"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                title="Fecha Hasta"
                className="w-full h-10 px-2 text-xs bg-bg-elevated/40 border border-border-light rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table or Loading Skeleton */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="relative">
          {isFetching && (
            <div className="absolute top-2 right-4 z-10">
              <span className="flex items-center gap-1.5 text-[11px] text-brand-primary font-mono bg-bg-surface/90 px-2.5 py-1 rounded-full border border-brand-primary/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                Actualizando...
              </span>
            </div>
          )}

          <AuditTable
            logs={logs}
            totalLogs={total}
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onSelectLog={handleSelectLog}
          />
        </div>
      )}

      {/* Forensic Detail Slide-Over Drawer */}
      <AuditDetailDrawer
        log={selectedLog}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
