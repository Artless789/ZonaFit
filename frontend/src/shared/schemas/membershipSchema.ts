import { z } from 'zod';

export const membershipSchema = z.object({
  client_id: z
    .number({ message: 'Debe seleccionar un cliente válido.' })
    .min(1, 'Debe seleccionar un cliente válido.'),
  membership_plan_id: z
    .number({ message: 'Debe seleccionar un plan válido.' })
    .min(1, 'Debe seleccionar un plan válido.'),
  trainer_name: z.string().optional(),
  start_date: z.string().min(1, 'La fecha de inicio es requerida.'),
  register_payment: z.boolean(),
  payment_method: z.string().optional(),
  amount_paid: z.number().min(0, 'El monto a pagar no puede ser negativo.').optional(),
  reference: z.string().optional(),
});

export type MembershipFormValues = z.infer<typeof membershipSchema>;


