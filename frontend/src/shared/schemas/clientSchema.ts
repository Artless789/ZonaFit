import { z } from 'zod';

export const clientSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  document_type: z.string().min(1, 'Selecciona un tipo de documento.'),
  document: z.string().min(5, 'El documento debe tener al menos 5 caracteres.'),
  phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres.'),
  email: z.union([z.literal(''), z.string().email('Debe ser un correo válido.')]).optional().nullable(),
  notes: z.string().optional().nullable(),
  // Asignación de membresía inicial (opcional al crear cliente)
  assign_membership: z.boolean().optional(),
  membership_plan_id: z.number().optional(),
  trainer_name: z.string().optional(),
  start_date: z.string().optional(),
  discount: z.number().min(0, 'El descuento no puede ser negativo.').optional(),
  register_payment: z.boolean().optional(),
  payment_method: z.string().optional(),
  amount_paid: z.number().min(0, 'El monto a pagar no puede ser negativo.').optional(),
  reference: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
