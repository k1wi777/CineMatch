import { z } from "zod";
import { NotificationTypeSchema } from "../domain/notification.js";
import { PaginationQuerySchema } from "./paginacion.js";

// Elemento al que apunta la notificación, para que la web pueda navegar hasta él.
export const TargetNotificacionSchema = z.object({
  tipo: z.enum(["recomendacion", "amistad", "resena"]),
  id: z.number().int(),
});

export type TargetNotificacion = z.infer<typeof TargetNotificacionSchema>;

// Notificación tal como la ve su destinatario (BE-5.2). Las fechas viajan en ISO 8601.
export const NotificacionSchema = z.object({
  id: z.number().int(),
  tipo: NotificationTypeSchema,
  fechaCreacion: z.string(),
  leida: z.boolean(),
  fechaLectura: z.string().nullable(),
  // Datos mínimos de quien originó la notificación; null si no hay origen de usuario.
  origen: z.object({ username: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  target: TargetNotificacionSchema,
});

export type Notificacion = z.infer<typeof NotificacionSchema>;

// Filtro ?soloNoLeidas=true|false, junto con la paginación estándar.
export const NotificacionesQuerySchema = PaginationQuerySchema.extend({
  soloNoLeidas: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
});

export type NotificacionesQuery = z.infer<typeof NotificacionesQuerySchema>;

export const PaginaNotificacionesSchema = z.object({
  items: z.array(NotificacionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const ContadorNoLeidasSchema = z.object({
  noLeidas: z.number().int(),
});

export type ContadorNoLeidas = z.infer<typeof ContadorNoLeidasSchema>;
