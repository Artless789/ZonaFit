import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  Building2, 
  Gift, 
  Search, 
  Eye, 
  X, 
  Users, 
  UserCheck, 
  Sparkles, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Receipt
} from 'lucide-react';
import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '@shared/ui/Badge';
import { Modal } from '@shared/ui/Modal';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { useToast } from '@shared/ui/Toast';
import { formatCurrency } from '@shared/utils/formatters';
import { SuperadminGym, SuperadminPlan, SuperadminSubscription, SuperadminPaymentItem } from '@shared/types/superadmin';

export function SuperadminGyms() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [selectedDetailGymId, setSelectedDetailGymId] = useState<number | null>(null);
  const [courtesyGym, setCourtesyGym] = useState<SuperadminGym | null>(null);

  // Refund state
  const [refundTargetPayment, setRefundTargetPayment] = useState<SuperadminPaymentItem | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [revokeAccessImmediately, setRevokeAccessImmediately] = useState(false);

  // Courtesy form state
  const [courtesyPlanId, setCourtesyPlanId] = useState<number | ''>('');
  const [isLifetime, setIsLifetime] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [activePreset, setActivePreset] = useState<string>('30d');

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query gyms list
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-gyms', { page, pageSize, search: debouncedSearch }],
    queryFn: () => superadminService.getGyms(page, pageSize, debouncedSearch),
  });

  // Query commercial plans for courtesy selection
  const { data: plansData } = useQuery({
    queryKey: ['superadmin-plans-all'],
    queryFn: () => superadminService.getPlans(1, 100),
  });

  // Query detailed gym info
  const { data: gymDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['superadmin-gym-detail', selectedDetailGymId],
    queryFn: () => superadminService.getGymDetail(selectedDetailGymId!),
    enabled: !!selectedDetailGymId,
  });

  // Courtesy mutation
  const assignCourtesyMutation = useMutation({
    mutationFn: ({ gymId, payload }: { gymId: number; payload: Partial<SuperadminSubscription> }) => 
      superadminService.assignSubscription(gymId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-gyms'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-gym-detail'] });
      setCourtesyGym(null);
    }
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ paymentId, reason, revoke }: { paymentId: number; reason: string; revoke: boolean }) => {
      if (!selectedDetailGymId) throw new Error('No gym selected');
      return superadminService.refundPayment(selectedDetailGymId, paymentId, {
        reason,
        revoke_access_immediately: revoke,
      });
    },
    onSuccess: (res) => {
      toast({
        type: 'success',
        title: 'Reembolso procesado',
        message: res.message || 'La transacción fue anulada en Wompi.',
      });
      queryClient.invalidateQueries({ queryKey: ['superadmin-gym-detail', selectedDetailGymId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-gyms'] });
      setRefundTargetPayment(null);
      setRefundReason('');
      setRevokeAccessImmediately(false);
    },
    onError: (err: any) => {
      toast({
        type: 'error',
        title: 'Error al reembolsar',
        message: err.response?.data?.detail || 'No se pudo procesar el reembolso en Wompi.',
      });
    },
  });

  // Open Courtesy Modal helper
  const openCourtesyModal = (gym: SuperadminGym) => {
    setCourtesyGym(gym);
    // Auto-select first active plan if available
    const firstActivePlan = plansData?.items?.find((p: SuperadminPlan) => p.is_active);
    setCourtesyPlanId(firstActivePlan ? firstActivePlan.id : '');
    setIsLifetime(false);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    setEndDate(in30Days.toISOString().split('T')[0]);
    setActivePreset('30d');
  };

  // Preset button handler
  const handleApplyPreset = (days: number, presetKey: string) => {
    setIsLifetime(false);
    setActivePreset(presetKey);
    const base = startDate ? new Date(startDate) : new Date();
    base.setDate(base.getDate() + days);
    setEndDate(base.toISOString().split('T')[0]);
  };

  // Calculate duration in days
  const durationDays = useMemo(() => {
    if (isLifetime) return null;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, endDate, isLifetime]);

  const handleSubmitCourtesy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtesyGym) return;

    assignCourtesyMutation.mutate({
      gymId: courtesyGym.id,
      payload: {
        plan_id: courtesyPlanId ? Number(courtesyPlanId) : undefined,
        status: 'ACTIVE',
        starts_at: new Date(startDate).toISOString(),
        ends_at: isLifetime ? null : new Date(endDate + 'T23:59:59').toISOString(),
        is_lifetime: isLifetime
      }
    });
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'info' | 'success' => {
    const r = role.toUpperCase();
    if (r === 'OWNER') return 'default';
    if (r === 'ADMIN') return 'info';
    if (r === 'COACH' || r === 'ENTRENADOR') return 'success';
    return 'default';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="rounded-xl border border-border-light bg-bg-surface/40 p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border-light bg-bg-surface/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">No se pudieron cargar los gimnasios.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header and Live Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Gimnasios Registrados</h1>
          <p className="text-text-secondary text-sm mt-1">Directorio global de tenants de la plataforma.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar gimnasio o correo..."
            className="w-full pl-10 pr-10 py-2 bg-bg-surface border border-border-medium/60 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5"
              title="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border-light bg-bg-surface/40 overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Building2 className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">
              {debouncedSearch ? 'Sin resultados' : 'No hay gimnasios'}
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {debouncedSearch 
                ? `No encontramos ningún gimnasio que coincida con "${debouncedSearch}".`
                : 'Aún no se ha registrado ningún gimnasio en la plataforma.'}
            </p>
            {debouncedSearch && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchTerm('')} 
                className="mt-4"
              >
                Limpiar filtro de búsqueda
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Gimnasio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Propietario</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Suscripción</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Onboarding</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((gym) => (
                  <tr key={gym.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-text-primary">{gym.name}</p>
                      <p className="text-xs text-text-muted">ID: #{gym.id} • {gym.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {gym.owner_name ? (
                        <>
                          <div className="font-medium text-text-primary">{gym.owner_name}</div>
                          <div className="text-xs text-text-muted">{gym.owner_email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Sin propietario</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {gym.current_plan_name ? (
                        <>
                          <div className="font-medium text-brand-primary">{gym.current_plan_name}</div>
                          <div className="text-xs mt-1">
                            {gym.subscription_status === 'ACTIVE' && <Badge variant="success">Activa</Badge>}
                            {gym.subscription_status === 'TRIAL' && <Badge variant="info">Trial</Badge>}
                            {gym.subscription_status === 'EXPIRED' && <Badge variant="warning">Vencida</Badge>}
                            {gym.subscription_status === 'CANCELLED' && <Badge variant="danger">Cancelada</Badge>}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Sin suscripción</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {gym.onboarding_completed ? (
                        <Badge variant="success">Completado</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {gym.is_active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="danger">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setSelectedDetailGymId(gym.id)}
                          className="p-2 rounded-md hover:bg-white/5 text-text-muted hover:text-brand-primary transition-colors inline-flex items-center"
                          title="Ver información y usuarios del gimnasio"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openCourtesyModal(gym)}
                          className="p-2 rounded-md hover:bg-white/5 text-text-muted hover:text-brand-primary transition-colors inline-flex items-center"
                          title="Otorgar Cortesía de Suscripción"
                        >
                          <Gift size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="border-t border-white/5 p-4 flex justify-center bg-white/1">
            <Pagination
              page={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: INFORMACIÓN DETALLADA DEL GIMNASIO Y USUARIOS                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedDetailGymId}
        onClose={() => setSelectedDetailGymId(null)}
        title="Detalles del Gimnasio"
        containerClassName="max-w-3xl"
        description="Información corporativa, métricas de operación y usuarios registrados."
      >
        {isLoadingDetail || !gymDetail ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-36 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Identity Card */}
            <div className="p-4 rounded-lg bg-white/3 border border-border-light flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-text-primary">{gymDetail.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-text-muted font-mono">
                    ID #{gymDetail.id}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-0.5">{gymDetail.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {gymDetail.is_active ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
                {gymDetail.onboarding_completed ? (
                  <Badge variant="success">Onboarding OK</Badge>
                ) : (
                  <Badge variant="warning">Onboarding Pendiente</Badge>
                )}
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-white/2 border border-border-light flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium">Usuarios del Sistema</div>
                  <div className="text-lg font-bold text-text-primary">{gymDetail.total_users}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-white/2 border border-border-light flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-success/10 text-success">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium">Socios / Clientes</div>
                  <div className="text-lg font-bold text-text-primary">{gymDetail.total_clients}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-white/2 border border-border-light flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-warning/10 text-warning">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium">Plan Comercial</div>
                  <div className="text-sm font-bold text-text-primary truncate max-w-32.5">
                    {gymDetail.current_plan_name || 'Sin plan'}
                  </div>
                </div>
              </div>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gym Info */}
              <div className="p-4 rounded-lg bg-white/2 border border-border-light space-y-3">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Datos de Contacto
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Mail size={15} className="text-text-muted shrink-0" />
                    <span className="truncate">{gymDetail.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Phone size={15} className="text-text-muted shrink-0" />
                    <span>{gymDetail.phone || 'No registrado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <MapPin size={15} className="text-text-muted shrink-0" />
                    <span className="truncate">{gymDetail.address || 'No registrada'}</span>
                  </div>
                </div>
              </div>

              {/* Owner and Subscription Info */}
              <div className="p-4 rounded-lg bg-white/2 border border-border-light space-y-3">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Propietario y Suscripción
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-text-muted block">Propietario / Dueño:</span>
                    <span className="font-medium text-text-primary">
                      {gymDetail.owner_name || 'Sin asignar'}
                    </span>
                    {gymDetail.owner_email && (
                      <span className="text-xs text-text-muted block">{gymDetail.owner_email}</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-xs text-text-muted block">Vigencia Suscripción:</span>
                    <span className="text-text-secondary font-medium">
                      {gymDetail.is_lifetime 
                        ? 'Cortesía Vitalicia (Lifetime)'
                        : gymDetail.subscription_ends_at 
                          ? `${formatDate(gymDetail.subscription_starts_at)} - ${formatDate(gymDetail.subscription_ends_at)}`
                          : 'Sin vigencia activa'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Users / Team Members Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} />
                  Usuarios Registrados ({gymDetail.users.length})
                </h4>
              </div>

              {gymDetail.users.length === 0 ? (
                <div className="p-6 text-center rounded-lg bg-white/1 border border-dashed border-border-light text-text-muted text-sm">
                  No hay usuarios vinculados a este gimnasio.
                </div>
              ) : (
                <div className="rounded-lg border border-border-light overflow-hidden bg-white/1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-xs font-medium text-text-muted">
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Correo</th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {gymDetail.users.map((user) => (
                        <tr key={user.id} className="hover:bg-white/2">
                          <td className="px-4 py-2.5 font-medium text-text-primary">{user.full_name}</td>
                          <td className="px-4 py-2.5 text-text-secondary text-xs">{user.email}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {user.is_active ? (
                              <span className="text-xs text-success flex items-center justify-end gap-1">
                                <CheckCircle2 size={13} /> Activo
                              </span>
                            ) : (
                              <span className="text-xs text-danger flex items-center justify-end gap-1">
                                <AlertCircle size={13} /> Inactivo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Subscription Payments History & Refund Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={14} />
                  Historial de Pagos de Suscripción ({gymDetail.payments?.length || 0})
                </h4>
              </div>

              {!gymDetail.payments || gymDetail.payments.length === 0 ? (
                <div className="p-4 text-center rounded-lg bg-white/1 border border-dashed border-border-light text-text-muted text-xs">
                  No hay pagos de suscripción registrados para este gimnasio.
                </div>
              ) : (
                <div className="rounded-lg border border-border-light overflow-hidden bg-white/1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-xs font-medium text-text-muted">
                        <th className="px-4 py-2.5">Fecha</th>
                        <th className="px-4 py-2.5">Monto</th>
                        <th className="px-4 py-2.5">Referencia</th>
                        <th className="px-4 py-2.5">Estado</th>
                        <th className="px-4 py-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {gymDetail.payments.map((p) => {
                        const isApproved = p.status === 'APPROVED';
                        const isVoided = p.status === 'VOIDED';
                        return (
                          <tr key={p.id} className="hover:bg-white/2">
                            <td className="px-4 py-2 text-xs text-text-secondary">
                              {formatDate(p.created_at)}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-text-primary">
                              {formatCurrency(p.amount_in_cents / 100)} {p.currency}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-text-muted truncate max-w-36" title={p.reference}>
                              {p.reference}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant={
                                  isApproved ? 'success' :
                                  isVoided ? 'warning' :
                                  p.status === 'DECLINED' || p.status === 'ERROR' ? 'danger' : 'default'
                                }>
                                  {isVoided ? 'REEMBOLSADO' : p.status}
                                </Badge>
                                {p.refund_reason && (
                                  <span className="text-[10px] text-warning truncate max-w-36" title={p.refund_reason}>
                                    {p.refund_reason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              {isApproved ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="text-xs py-1 px-2.5 flex items-center gap-1 ml-auto"
                                  onClick={() => {
                                    setRefundTargetPayment(p);
                                    setRefundReason('');
                                    setRevokeAccessImmediately(false);
                                  }}
                                >
                                  <RotateCcw size={12} />
                                  <span>Reembolsar</span>
                                </Button>
                              ) : isVoided ? (
                                <span className="text-[11px] text-text-muted">Anulado</span>
                              ) : (
                                <span className="text-[11px] text-text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setSelectedDetailGymId(null)}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const currentGym = data?.items.find(g => g.id === gymDetail.id);
                  setSelectedDetailGymId(null);
                  if (currentGym) openCourtesyModal(currentGym);
                }}
                className="flex items-center gap-2"
              >
                <Gift size={16} />
                Otorgar Cortesía
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: ASIGNACIÓN DE CORTESÍA AVANZADA                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!courtesyGym}
        onClose={() => setCourtesyGym(null)}
        title="Otorgar Cortesía de Suscripción"
        containerClassName="max-w-xl"
        description={`Configura el periodo de cortesía y plan comercial para "${courtesyGym?.name}".`}
      >
        <form onSubmit={handleSubmitCourtesy} className="space-y-5">
          {/* Plan Selection */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Plan Comercial
            </label>
            <select
              value={courtesyPlanId}
              onChange={(e) => setCourtesyPlanId(e.target.value ? Number(e.target.value) : '')}
              className="w-full h-11 px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-sm text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            >
              <option value="">Cortesía Personalizada (Sin plan específico)</option>
              {plansData?.items?.map((plan: SuperadminPlan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.currency} ${plan.price.toLocaleString()} / {plan.billing_interval})
                </option>
              ))}
            </select>
          </div>

          {/* Lifetime Switch / Checkbox */}
          <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="lifetime-checkbox" className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                <Sparkles size={16} className="text-brand-primary" />
                Acceso Vitalicio (Lifetime)
              </label>
              <p className="text-xs text-text-muted">
                Otorga acceso permanente sin fecha de expiración.
              </p>
            </div>
            <input
              type="checkbox"
              id="lifetime-checkbox"
              checked={isLifetime}
              onChange={(e) => {
                setIsLifetime(e.target.checked);
                if (e.target.checked) setActivePreset('lifetime');
                else handleApplyPreset(30, '30d');
              }}
              className="w-5 h-5 rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface cursor-pointer"
            />
          </div>

          {/* Duration Presets (visible if not lifetime) */}
          {!isLifetime && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                Selección Rápida de Periodo
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: '7 días', days: 7, key: '7d' },
                  { label: '15 días', days: 15, key: '15d' },
                  { label: '1 mes', days: 30, key: '30d' },
                  { label: '3 meses', days: 90, key: '90d' },
                  { label: '6 meses', days: 180, key: '180d' },
                  { label: '1 año', days: 365, key: '365d' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleApplyPreset(preset.days, preset.key)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-all ${
                      activePreset === preset.key && !isLifetime
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-semibold'
                        : 'border-border-light bg-white/2 text-text-secondary hover:bg-white/5 hover:text-text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Pickers */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Input
                  type="date"
                  label="Fecha de Inicio"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  required
                />
                <Input
                  type="date"
                  label="Fecha de Vencimiento"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  required
                />
              </div>
            </div>
          )}

          {/* Real-time Summary Box */}
          <div className="p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/20 space-y-1.5">
            <div className="text-xs font-semibold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={15} />
              Resumen de la Cortesía
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Gimnasio: <strong className="text-text-primary">{courtesyGym?.name}</strong> • Plan:{' '}
              <strong className="text-text-primary">
                {plansData?.items?.find((p: SuperadminPlan) => p.id === courtesyPlanId)?.name || 'Cortesía Personalizada'}
              </strong>
            </p>
            <p className="text-xs text-text-secondary">
              Vigencia:{' '}
              {isLifetime ? (
                <span className="text-success font-semibold">Acceso Vitalicio Indefinido (Lifetime)</span>
              ) : (
                <span>
                  Del <strong className="text-text-primary">{startDate}</strong> al{' '}
                  <strong className="text-text-primary">{endDate}</strong> ({durationDays} días totales)
                </span>
              )}
            </p>
          </div>

          {assignCourtesyMutation.isError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              Error al asignar la cortesía. Verifica los datos e intenta de nuevo.
            </div>
          )}

          {/* Modal Buttons */}
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button 
              variant="ghost" 
              type="button" 
              onClick={() => setCourtesyGym(null)}
              disabled={assignCourtesyMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={assignCourtesyMutation.isPending || (!isLifetime && (!startDate || !endDate || durationDays === 0))}
            >
              {assignCourtesyMutation.isPending ? 'Otorgando cortesía...' : 'Confirmar Cortesía'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN DE REEMBOLSO WOMPI                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!refundTargetPayment}
        onClose={() => setRefundTargetPayment(null)}
        title="Confirmar Reembolso de Suscripción"
        containerClassName="max-w-lg"
        description={`Se enviará una solicitud de anulación/reembolso a la pasarela Wompi para "${gymDetail?.name}".`}
      >
        {refundTargetPayment && (
          <div className="space-y-4 text-sm">
            <div className="p-3.5 rounded-lg bg-white/2 border border-border-light space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Referencia:</span>
                <span className="font-mono text-text-primary text-xs">{refundTargetPayment.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Monto:</span>
                <span className="font-semibold text-text-primary">
                  {formatCurrency(refundTargetPayment.amount_in_cents / 100)} {refundTargetPayment.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Fecha del Pago:</span>
                <span className="text-text-secondary">{formatDate(refundTargetPayment.created_at)}</span>
              </div>
              {refundTargetPayment.provider_transaction_id && (
                <div className="flex justify-between">
                  <span className="text-text-muted">ID Transacción Wompi:</span>
                  <span className="font-mono text-text-muted text-xs">{refundTargetPayment.provider_transaction_id}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                Motivo del Reembolso <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="Ej: Solicitud expresa del cliente dentro de garantía de satisfacción"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                required
              />
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="revoke-access-checkbox" className="text-xs font-semibold text-text-primary cursor-pointer flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-warning" />
                  Revocar Acceso Inmediatamente
                </label>
                <p className="text-[11px] text-text-muted">
                  Si se activa, el plan del gimnasio pasará a CANCELLED y se suspenderán los torniquetes hoy.
                </p>
              </div>
              <input
                type="checkbox"
                id="revoke-access-checkbox"
                checked={revokeAccessImmediately}
                onChange={(e) => setRevokeAccessImmediately(e.target.checked)}
                className="w-4 h-4 rounded border-border-medium bg-bg-surface text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger/90">
              Esta acción es irreversible en la pasarela Wompi. Los fondos se retornarán al medio de pago original del cliente.
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setRefundTargetPayment(null)}
                disabled={refundMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={!refundReason.trim() || refundMutation.isPending}
                onClick={() => {
                  refundMutation.mutate({
                    paymentId: refundTargetPayment.id,
                    reason: refundReason.trim(),
                    revoke: revokeAccessImmediately,
                  });
                }}
                className="flex items-center gap-2"
              >
                <RotateCcw size={14} />
                <span>{refundMutation.isPending ? 'Procesando en Wompi...' : 'Confirmar Reembolso'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
