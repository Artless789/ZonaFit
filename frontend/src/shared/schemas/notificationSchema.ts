import { z } from 'zod';

export const notificationSendSchema = z.object({
  client_id: z.string().optional(),
  event_type: z.string().min(1, 'El tipo de evento es requerido'),
  channel: z.string().min(1, 'El canal es requerido'),
  recipient: z
    .string()
    .min(8, 'Debe ingresar un número de teléfono válido (mín. 8 dígitos)')
    .regex(/^[+\d\s\-()]+$/, 'Solo se permiten dígitos, espacios, +, - y paréntesis'),
  message_body: z.string().min(5, 'El mensaje debe tener al menos 5 caracteres').max(4096, 'Máximo 4096 caracteres (límite WhatsApp)'),
});

export type NotificationSendFormValues = z.infer<typeof notificationSendSchema>;
