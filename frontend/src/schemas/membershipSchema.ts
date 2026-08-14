import { z } from 'zod';

export const membershipSchema = z.object({
  client_id: z.coerce
    .number()
    .min(1, 'Debe seleccionar un cliente válido.'),
  membership_plan_id: z.coerce
    .number()
    .min(1, 'Debe seleccionar un plan válido.'),
  trainer_name: z.string().optional(),
});

export type MembershipFormValues = z.infer<typeof membershipSchema>;
