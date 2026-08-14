import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membershipService } from '../services/membershipService';
import { MembershipCreate, MembershipUpdate, Membership } from '../types/membership';
import { Paginated } from '../services/membershipPlanService'; // We share this type for now

export const useMemberships = () => {
  const queryClient = useQueryClient();
  const queryKey = ['memberships'];

  const query = useQuery<Paginated<Membership>, Error>({
    queryKey,
    queryFn: membershipService.getMemberships,
  });

  const createMutation = useMutation<Membership, Error, MembershipCreate>({
    mutationFn: membershipService.createMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation<Membership, Error, { id: number; data: MembershipUpdate }>({
    mutationFn: ({ id, data }) => membershipService.updateMembership(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: membershipService.deleteMembership,
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
