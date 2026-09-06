import { Select, SelectItem } from '@shared/ui/Select';
import { Input } from '@shared/ui/Input';
import { useState, useMemo } from 'react';
import { ShieldCheck, Activity } from 'lucide-react';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { AuditTable } from './AuditTable';
import { Skeleton } from '@shared/ui/Skeleton';

export function AuditPage() {
  const [action, setAction] = useState<string>('ALL');
  const [entityType, setEntityType] = useState<string>('ALL');
  const [userId, setUserId] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const handleActionChange = (val: string) => {
    setAction(val);
    setPage(1);
  };

  const handleEntityTypeChange = (val: string) => {
    setEntityType(val);
    setPage(1);
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value);
    setPage(1);
  };

  const { query } = useAuditLogs(
    150, 
    0, 
    action === 'ALL' ? undefined : action,
    entityType === 'ALL' ? undefined : entityType,
    userId ? parseInt(userId) : undefined
  );
  
  const logs = query.data?.items || [];
  const isLoading = query.isLoading;

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, currentPage, pageSize]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <ShieldCheck className="text-brand-primary" size={32} />
            Auditoría de Sistema
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Registro inmutable de todas las acciones críticas realizadas en el sistema (Creación, Modificación, Eliminación).
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Info Banner */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 mb-6 bg-brand-primary/5 border-brand-primary/20 flex items-start gap-4 p-4">
          <div className="bg-brand-primary/10 p-2 rounded-full mt-1">
            <Activity className="text-brand-primary" size={20} />
          </div>
          <div>
            <h4 className="text-text-primary font-semibold text-sm">Monitoreo en Tiempo Real</h4>
            <p className="text-text-secondary text-xs mt-1">
              Todos los cambios realizados en módulos críticos (Membresías, Clientes, Ventas, Planes) son registrados automáticamente.
              Solo usuarios con privilegios de Administrador o Auditor pueden visualizar este panel.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 mb-6 p-4 flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/3">
            <label className="text-xs font-medium text-text-secondary mb-1 block">Acción</label>
            <Select value={action} onValueChange={handleActionChange}>
              <SelectItem value="ALL">Todas las acciones</SelectItem>
              <SelectItem value="USER_CREATED">Creación de Usuario</SelectItem>
              <SelectItem value="USER_UPDATED">Modificación de Usuario</SelectItem>
              <SelectItem value="ROLE_CHANGED">Cambio de Rol</SelectItem>
              <SelectItem value="USER_DEACTIVATED">Desactivación de Usuario</SelectItem>
              <SelectItem value="LOGIN">Inicios de Sesión</SelectItem>
              <SelectItem value="CREATE">Creación (General)</SelectItem>
              <SelectItem value="UPDATE">Modificación (General)</SelectItem>
              <SelectItem value="DELETE">Eliminación (General)</SelectItem>
              <SelectItem value="SUBSCRIPTION_CREATED">Suscripción Creada</SelectItem>
            </Select>
          </div>
          <div className="w-full md:w-1/3">
            <label className="text-xs font-medium text-text-secondary mb-1 block">Módulo / Entidad</label>
            <Select value={entityType} onValueChange={handleEntityTypeChange}>
              <SelectItem value="ALL">Todos los módulos</SelectItem>
              <SelectItem value="User">Usuarios y Personal</SelectItem>
              <SelectItem value="Client">Clientes</SelectItem>
              <SelectItem value="Membership">Membresías</SelectItem>
              <SelectItem value="Sale">Ventas (POS)</SelectItem>
              <SelectItem value="Payment">Pagos</SelectItem>
              <SelectItem value="AccountsReceivable">Créditos</SelectItem>
              <SelectItem value="CashRegister">Caja</SelectItem>
              <SelectItem value="GymSettings">Configuración del Gimnasio</SelectItem>
            </Select>
          </div>
          <div className="w-full md:w-1/3">
            <label className="text-xs font-medium text-text-secondary mb-1 block">ID de Usuario</label>
            <Input 
              placeholder="Buscar por ID de usuario..." 
              value={userId}
              onChange={handleUserIdChange}
            />
          </div>
        </div>

        <AuditTable 
          logs={paginatedLogs} 
          totalLogs={logs.length}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
