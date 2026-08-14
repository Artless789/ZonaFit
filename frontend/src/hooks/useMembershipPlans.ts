import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membershipPlanService } from '../services/membershipPlanService';
import { MembershipPlanCreate, MembershipPlanUpdate, MembershipPlan } from '../types/membershipPlan';
import { Paginated } from '../services/membershipPlanService';

export const useMembershipPlans = () => {
  const queryClient = useQueryClient();
  const queryKey = ['membershipPlans'];

  const query = useQuery<Paginated<MembershipPlan>, Error>({
    queryKey,
    queryFn: membershipPlanService.getPlans,
  });

  const createMutation = useMutation<MembershipPlan, Error, MembershipPlanCreate>({
    mutationFn: membershipPlanService.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation<MembershipPlan, Error, { id: number; data: MembershipPlanUpdate }>({
    mutationFn: ({ id, data }) => membershipPlanService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: membershipPlanService.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
