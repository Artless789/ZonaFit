import { useState, useMemo } from 'react';
import { Tag, UserCheck, Plus } from 'lucide-react';
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
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

export function MembershipsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  // Queries
  const plansQuery = useMembershipPlans();
  const membershipsQuery = useMemberships();
  const clientsQuery = useClients(1, 500);

  const plans = (Array.isArray(plansQuery.query.data) ? plansQuery.query.data : plansQuery.query.data?.items) || [];
  const memberships = (Array.isArray(membershipsQuery.query.data) ? membershipsQuery.query.data : membershipsQuery.query.data?.items) || [];
  const clients = (Array.isArray(clientsQuery.query.data) ? clientsQuery.query.data : clientsQuery.query.data?.items) || [];

  // Enriched Memberships (Prioritizes server-embedded client/plan with client list fallback)
  const enrichedMemberships: EnrichedMembership[] = useMemo(() => {
    return memberships.map(m => {
      const client = m.client || clients.find(c => c.id === m.client_id);
      const plan = m.membership_plan || plans.find(p => p.id === m.membership_plan_id);
      return {
        ...m,
        clientName: m.client?.full_name || m.client_name || client?.full_name || 'Desconocido',
        planName: m.membership_plan?.name || m.plan_name || plan?.name || 'Plan Eliminado',
      };
    });
  }, [memberships, clients, plans]);

  // Drawer States
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedMembershipForDetail, setSelectedMembershipForDetail] = useState<Membership | null>(null);

  // Handlers for Details
  const handleViewDetails = (membership: Membership) => {
    setSelectedMembershipForDetail(membership);
    setIsDetailDrawerOpen(true);
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
        toast({ type: 'warning', title: 'Plan Desactivado', message: 'El plan ya no estará disponible para nuevas suscripciones.' });
      } else {
        await plansQuery.updateMutation.mutateAsync({ id: plan.id, data: { is_active: true } });
        toast({ type: 'success', title: 'Plan Reactivado', message: 'El plan vuelve a estar disponible.' });
      }
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado del plan.' });
    }
  };

  // Handlers for Subscriptions
  const handleOpenAssignSubscription = () => {
    setIsSubscriptionDrawerOpen(true);
  };
  const handleToggleSubscriptionStatus = async (membership: Membership) => {
    try {
      if (membership.is_active) {
        await membershipsQuery.updateMutation.mutateAsync({ id: membership.id, data: { is_active: false, status: 'CANCELLED' } });
        toast({ type: 'warning', title: 'Suscripción Cancelada', message: 'Se ha cortado el acceso al cliente.' });
      } else {
        await membershipsQuery.updateMutation.mutateAsync({ id: membership.id, data: { is_active: true, status: 'ACTIVE' } });
        toast({ type: 'success', title: 'Suscripción Reactivada', message: 'El acceso ha sido restaurado.' });
      }
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado de la suscripción.' });
    }
  };

  const isLoading = plansQuery.query.isLoading || membershipsQuery.query.isLoading || clientsQuery.query.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Membresías</h1>
          <p className="text-text-secondary text-sm mt-1">
            Administra los planes de tu gimnasio y controla las suscripciones de los clientes.
          </p>
        </div>
        
        {/* Dynamic Action Button based on Active Tab */}
        {activeTab === 'subscriptions' ? (
          <ActionGlowButton onClick={handleOpenAssignSubscription}>
            <Plus size={18} />
            <span>Asignar Plan a Cliente</span>
          </ActionGlowButton>
        ) : (
          <ActionGlowButton onClick={handleOpenCreatePlan}>
            <Plus size={18} />
            <span>Crear Nuevo Plan</span>
          </ActionGlowButton>
        )}
      </div>

      {/* Segmented Control / Tabs */}
      <div className="bg-surface-panel/80 border border-border-subtle p-1 rounded-[var(--radius-lg)] shadow-subtle backdrop-blur-md w-full max-w-sm flex relative">
        {/* Animated Background Pill */}
        <div 
          className="absolute inset-y-1 rounded-[var(--radius-md)] bg-surface-raised border border-border-medium shadow-elevated transition-all duration-200 ease-out z-0"
          style={{
            width: 'calc(50% - 4px)',
            left: activeTab === 'subscriptions' ? '4px' : 'calc(50%)',
          }}
        />
        
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
            activeTab === 'subscriptions' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          <UserCheck size={16} />
          <span>Suscripciones</span>
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
            activeTab === 'plans' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          <Tag size={16} />
          <span>Catálogo de Planes</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'subscriptions' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <MembershipsTable 
              memberships={enrichedMemberships} 
              onToggleStatus={handleToggleSubscriptionStatus}
              onViewDetails={handleViewDetails}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        onClose={() => setIsSubscriptionDrawerOpen(false)}
        clients={clients}
        plans={plans}
      />
      <MembershipDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        membership={selectedMembershipForDetail}
        clients={clients}
        plans={plans}
      />
    </div>
  );
}
