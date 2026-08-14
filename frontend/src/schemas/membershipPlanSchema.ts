import { z } from 'zod';

export const membershipPlanSchema = z.object({
  name: z.string().min(3, 'El nombre del plan debe tener al menos 3 caracteres.'),
  description: z.string().optional().nullable(),
  duration_days: z.coerce
    .number()
    .int('Debe ser un número entero.')
    .min(1, 'La duración debe ser de al menos 1 día.')
    .max(3650, 'Duración máxima excedida.'),
  price: z.coerce
    .number()
    .min(0, 'El precio no puede ser negativo.'),
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanSchema>;
