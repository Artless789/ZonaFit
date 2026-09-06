import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { membershipPlanService } from '../services/membershipPlanService';
import { MembershipPlanCreate, MembershipPlanUpdate, MembershipPlan } from '@shared/types/membershipPlan';
import { Paginated } from '../services/membershipPlanService';

export const useMembershipPlans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['membershipPlans', user?.gym_id];

  const query = useQuery<Paginated<MembershipPlan>, Error>({
    queryKey,
    queryFn: membershipPlanService.getPlans,
    enabled: !!user?.gym_id && user?.role?.toUpperCase() !== 'SUPERADMIN',
  });

  const createMutation = useMutation<MembershipPlan, Error, MembershipPlanCreate>({
    mutationFn: membershipPlanService.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] });
    },
  });

  const updateMutation = useMutation<MembershipPlan, Error, { id: number; data: MembershipPlanUpdate }>({
    mutationFn: ({ id, data }) => membershipPlanService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: membershipPlanService.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
