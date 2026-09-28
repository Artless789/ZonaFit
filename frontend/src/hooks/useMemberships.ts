import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { membershipService } from '../services/membershipService';
import { MembershipCreate, MembershipUpdate, Membership } from '@shared/types/membership';
import { Paginated } from '../services/membershipPlanService';

export const useMemberships = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['memberships', user?.gym_id];

  const query = useQuery<Paginated<Membership>, Error>({
    queryKey,
    queryFn: () => membershipService.getMemberships(),
    enabled: !!user?.gym_id && user?.role?.toUpperCase() !== 'SUPERADMIN',
  });

  const createMutation = useMutation<Membership, Error, MembershipCreate>({
    mutationFn: membershipService.createMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivables'] });
    },
  });

  const updateMutation = useMutation<Membership, Error, { id: number; data: MembershipUpdate }>({
    mutationFn: ({ id, data }) => membershipService.updateMembership(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: membershipService.deleteMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
