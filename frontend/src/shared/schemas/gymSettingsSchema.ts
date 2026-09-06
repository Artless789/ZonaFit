import { z } from 'zod';

export const gymSettingsSchema = z.object({
  legal_name: z.string().min(3, 'La razón social debe tener al menos 3 caracteres.'),
  trade_name: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres.'),
  tax_id: z.string().min(5, 'El NIT/RUT no es válido.'),
  tax_regime: z.string().optional(),
  official_phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres.'),
  official_email: z.string().email('Debe ser un correo electrónico válido.'),
  physical_address: z.string().min(5, 'La dirección es muy corta.'),
  city: z.string().min(2, 'Ciudad inválida.'),
  country: z.string().min(2, 'País inválido.'),
  currency: z.string().length(3, 'La moneda debe ser un código de 3 letras (Ej. COP).'),
  timezone: z.string().min(3, 'Zona horaria inválida.'),
  default_tax_percentage: z.coerce
    .number()
    .min(0, 'El impuesto no puede ser negativo.')
    .max(100, 'El impuesto no puede ser mayor a 100.'),
  receipt_footer_notes: z.string().optional(),
});

export type GymSettingsFormValues = z.infer<typeof gymSettingsSchema>;
