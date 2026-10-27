import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "recomendacion_recibida",
  "recomendacion_aceptada",
  "recomendacion_completada",
  "solicitud_amistad",
  "amistad_aceptada",
  "resena_oculta",
] as const;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
