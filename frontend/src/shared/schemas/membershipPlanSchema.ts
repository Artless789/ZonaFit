import { z } from 'zod';

export const membershipPlanSchema = z.object({
  name: z.string().min(3, 'El nombre del plan debe tener al menos 3 caracteres.'),
  description: z.string().max(5000, 'La descripción no puede exceder 5000 caracteres.').optional().nullable(),
  duration_days: z
    .number({ message: 'Debe ser un número entero.' })
    .int('Debe ser un número entero.')
    .min(1, 'La duración debe ser de al menos 1 día.')
    .max(3650, 'Duración máxima excedida.'),
  price: z
    .number({ message: 'Debe ser un número.' })
    .min(0, 'El precio no puede ser negativo.'),
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanSchema>;
