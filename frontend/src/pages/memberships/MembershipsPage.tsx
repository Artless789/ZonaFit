import { useState, useMemo } from 'react';
import { Tag, UserCheck, Plus, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useMembershipPlans } from '../../hooks/useMembershipPlans';
import { useMemberships } from '../../hooks/useMemberships';
import { useClients } from '../../hooks/useClients';
import { MembershipPlansTable } from './MembershipPlansTable';
import { MembershipPlanDrawer } from './MembershipPlanDrawer';
import { MembershipsTable, EnrichedMembership } from './MembershipsTable';
import { MembershipDrawer } from './MembershipDrawer';
import { MembershipDetailDrawer } from './MembershipDetailDrawer';
import type { Membership } from '@shared/types/membership';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';
import { parseISO } from 'date-fns';

export function MembershipsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  // Queries
  const plansQuery = useMembershipPlans();
  const membershipsQuery = useMemberships();
  const clientsQuery = useClients(1, 100);

  const plans = useMemo(
    () => (Array.isArray(plansQuery.query.data) ? plansQuery.query.data : plansQuery.query.data?.items) || [],
    [plansQuery.query.data]
  );
  const memberships = useMemo(
    () => (Array.isArray(membershipsQuery.query.data) ? membershipsQuery.query.data : membershipsQuery.query.data?.items) || [],
    [membershipsQuery.query.data]
  );
  const clients = useMemo(
    () => (Array.isArray(clientsQuery.query.data) ? clientsQuery.query.data : clientsQuery.query.data?.items) || [],
    [clientsQuery.query.data]
  );

  // Enriched Memberships (Prioritizes server-embedded client/plan with client list fallback)
  const enrichedMemberships: EnrichedMembership[] = useMemo(() => {
    return memberships.map((m) => {
      const client = m.client || clients.find((c) => c.id === m.client_id);
      const plan = m.membership_plan || plans.find((p) => p.id === m.membership_plan_id);
      return {
        ...m,
        clientName: m.client?.full_name || m.client_name || client?.full_name || 'Desconocido',
        planName: m.membership_plan?.name || m.plan_name || plan?.name || 'Plan Eliminado',
      };
    });
  }, [memberships, clients, plans]);

  // Derived Summary KPIs
  const summaryKPIs = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    enrichedMemberships.forEach((m) => {
      try {
        const end = parseISO(m.end_date);
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        const days = Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
        const isAct = m.is_active && m.status?.toUpperCase() === 'ACTIVE' && days >= 0;

        if (isAct) {
          active++;
          if (days <= 7) expiring++;
        } else {
          expired++;
        }
      } catch {
        // Ignored
      }
    });

    const activePlansCount = plans.filter((p) => p.is_active).length;

    return {
      active,
      expiring,
      expired,
      activePlansCount,
      total: enrichedMemberships.length,
    };
  }, [enrichedMemberships, plans]);

  // Drawer States
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedMembershipForDetail, setSelectedMembershipForDetail] = useState<Membership | null>(null);

  // Renewal target state
  const [renewalTarget, setRenewalTarget] = useState<Membership | null>(null);

  // Handlers for Details & Renewals
  const handleViewDetails = (membership: Membership) => {
    setSelectedMembershipForDetail(membership);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenRenew = (membership: Membership) => {
    setRenewalTarget(membership);
    setIsSubscriptionDrawerOpen(true);
  };

  const handleOpenCreateSubscription = () => {
    setRenewalTarget(null);
    setIsSubscriptionDrawerOpen(true);
  };

  // Handlers for Plans
  const handleOpenCreatePlan = () => {
    setSelectedPlan(null);
    setIsPlanDrawerOpen(true);
  };

  const handleOpenEditPlan = (plan: MembershipPlan) => {
    setSelectedPlan(plan);
    setIsPlanDrawerOpen(true);
  };

  const handleTogglePlanStatus = async (plan: MembershipPlan) => {
    try {
      if (plan.is_active) {
        await plansQuery.deleteMutation.mutateAsync(plan.id);
        toast({
          type: 'warning',
          title: 'Plan Desactivado',
          message: 'El plan ya no estará disponible para nuevas suscripciones.',
        });
      } else {
        await plansQuery.updateMutation.mutateAsync({ id: plan.id, data: { is_active: true } });
        toast({
          type: 'success',
          title: 'Plan Reactivado',
          message: 'El plan vuelve a estar disponible.',
        });
      }
    } catch {
      toast({
        type: 'error',
        title: 'Error de Estado',
        message: 'No se pudo cambiar el estado del plan.',
      });
    }
  };

  // Handlers for Subscriptions
  const handleToggleSubscriptionStatus = async (membership: Membership) => {
    try {
      if (membership.is_active) {
        await membershipsQuery.updateMutation.mutateAsync({
          id: membership.id,
          data: { is_active: false, status: 'CANCELLED' },
        });
        toast({
          type: 'warning',
          title: 'Suscripción Cancelada',
          message: 'Se ha cortado el acceso al cliente.',
        });
      } else {
        await membershipsQuery.updateMutation.mutateAsync({
          id: membership.id,
          data: { is_active: true, status: 'ACTIVE' },
        });
        toast({
          type: 'success',
          title: 'Suscripción Reactivada',
          message: 'El acceso del cliente ha sido restaurado.',
        });
      }
    } catch {
      toast({
        type: 'error',
        title: 'Error de Estado',
        message: 'No se pudo cambiar el estado de la suscripción.',
      });
    }
  };

  const isLoading =
    plansQuery.query.isLoading ||
    membershipsQuery.query.isLoading ||
    clientsQuery.query.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
        </div>
        <Skeleton className="h-96 w-full rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 relative">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <SectionEyebrow
              label="GESTIÓN DE SOCIOS // MEMBRESÍAS"
              title="Membresías & Cobertura"
            />
            <StatusBadge
              status="active"
              size="sm"
              label={`${summaryKPIs.active} Activas`}
            />
          </div>
          <p className="text-xs text-text-secondary">
            Control de suscripciones, vigencias, renovaciones continuas y catálogo de planes.
          </p>
        </div>

        {/* Dynamic Action Button based on Active Tab */}
        {activeTab === 'subscriptions' ? (
          <ActionGlowButton onClick={handleOpenCreateSubscription} className="text-xs font-bold">
            <Plus size={16} />
            <span>Asignar Plan a Socio</span>
          </ActionGlowButton>
        ) : (
          <ActionGlowButton onClick={handleOpenCreatePlan} className="text-xs font-bold">
            <Plus size={16} />
            <span>Crear Nuevo Plan</span>
          </ActionGlowButton>
        )}
      </div>

      {/* Realtime KPI Strip (derived from loaded data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[18px] border border-border-subtle bg-surface-panel/80 flex items-center justify-between shadow-subtle backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              Suscripciones Activas
            </span>
            <span className="text-xl font-black font-mono text-emerald-400">
              {summaryKPIs.active}
            </span>
          </div>
          <CheckCircle2 size={18} className="text-emerald-400 opacity-80" />
        </div>

        <div className="p-3.5 rounded-[18px] border border-border-subtle bg-surface-panel/80 flex items-center justify-between shadow-subtle backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              Por Vencer (≤ 7 días)
            </span>
            <span className="text-xl font-black font-mono text-amber-400">
              {summaryKPIs.expiring}
            </span>
          </div>
          <Clock size={18} className="text-amber-400 opacity-80" />
        </div>

        <div className="p-3.5 rounded-[18px] border border-border-subtle bg-surface-panel/80 flex items-center justify-between shadow-subtle backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              Vencidas / Por Renovar
            </span>
            <span className="text-xl font-black font-mono text-rose-400">
              {summaryKPIs.expired}
            </span>
          </div>
          <ShieldAlert size={18} className="text-rose-400 opacity-80" />
        </div>

        <div className="p-3.5 rounded-[18px] border border-border-subtle bg-surface-panel/80 flex items-center justify-between shadow-subtle backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              Planes de Catálogo
            </span>
            <span className="text-xl font-black font-mono text-brand-primary">
              {summaryKPIs.activePlansCount}
            </span>
          </div>
          <Tag size={18} className="text-brand-primary opacity-80" />
        </div>
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-surface-panel border border-border-subtle p-1 rounded-[var(--radius-xl)] shadow-subtle w-full max-w-sm flex relative">
        <div
          className="absolute inset-y-1 rounded-[var(--radius-lg)] bg-surface-raised border border-border-medium shadow-elevated transition-all duration-300 ease-out z-0"
          style={{
            width: 'calc(50% - 4px)',
            left: activeTab === 'subscriptions' ? '4px' : 'calc(50%)',
          }}
        />

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'subscriptions'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <UserCheck size={15} />
          <span>Suscripciones ({summaryKPIs.total})</span>
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'plans'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Tag size={15} />
          <span>Catálogo ({plans.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'subscriptions' ? (
          <div className="animate-in fade-in duration-200">
            <MembershipsTable
              memberships={enrichedMemberships}
              onToggleStatus={handleToggleSubscriptionStatus}
              onViewDetails={handleViewDetails}
              onRenew={handleOpenRenew}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <MembershipPlansTable
              plans={plans}
              onEdit={handleOpenEditPlan}
              onToggleStatus={handleTogglePlanStatus}
            />
          </div>
        )}
      </div>

      {/* Drawers */}
      <MembershipPlanDrawer
        isOpen={isPlanDrawerOpen}
        onClose={() => setIsPlanDrawerOpen(false)}
        plan={selectedPlan}
      />
      <MembershipDrawer
        isOpen={isSubscriptionDrawerOpen}
        onClose={() => {
          setIsSubscriptionDrawerOpen(false);
          setRenewalTarget(null);
        }}
        clients={clients}
        plans={plans}
        initialClientId={renewalTarget?.client_id || null}
        initialPlanId={renewalTarget?.membership_plan_id || null}
        isRenewal={!!renewalTarget}
      />
      <MembershipDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        membership={selectedMembershipForDetail}
        clients={clients}
        plans={plans}
        onRenew={(m) => {
          setIsDetailDrawerOpen(false);
          handleOpenRenew(m);
        }}
      />
    </div>
  );
}
