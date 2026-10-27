import { z } from "zod";
import { TipoContenidoSchema } from "./catalogo.js";
import { VisibilidadResenaSchema } from "./resenas.js";

// Sincronización manual del catálogo (BE-12.1).
export const EstadoSincronizacionSchema = z.object({
  estado: z.enum(["inactiva", "en_curso", "ok", "error"]),
  iniciadaEn: z.string().nullable(),
  terminadaEn: z.string().nullable(),
  ultimoResumen: z
    .object({
      agregados: z.number().int(),
      actualizados: z.number().int(),
      descartados: z.number().int(),
      generosAgregados: z.number().int(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export type EstadoSincronizacion = z.infer<typeof EstadoSincronizacionSchema>;

// Moderación de reseñas (BE-12.2): el administrador ve todas las visibilidades.
export const ModeracionQuerySchema = z.object({
  estado: z.enum(["visible", "oculta"]).optional(),
  contentId: z.coerce.number().int().positive().optional(),
  autor: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ModeracionQuery = z.infer<typeof ModeracionQuerySchema>;

export const ResenaModeracionSchema = z.object({
  id: z.number().int(),
  calificacion: z.number(),
  etiquetas: z.array(z.string()),
  comentario: z.string().nullable(),
  esSpoiler: z.boolean(),
  visibilidad: VisibilidadResenaSchema,
  visible: z.boolean(),
  fechaCreacion: z.string(),
  autor: z.object({ id: z.number().int(), username: z.string() }),
  contenido: z.object({ id: z.number().int(), titulo: z.string(), tipo: TipoContenidoSchema }),
});

export type ResenaModeracion = z.infer<typeof ResenaModeracionSchema>;
