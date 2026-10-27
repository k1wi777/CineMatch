import { z } from "zod";
import { TipoContenidoSchema } from "./catalogo.js";

// Recomendaciones generales de la comunidad (BE-11). Cada ítem indica si viene del ranking comunitario o del respaldo por popularidad.
export const OrigenRecomendacionSchema = z.enum(["comunidad", "popularidad"]);

export const RecomendacionComunidadSchema = z.object({
  id: z.number().int(),
  tipo: TipoContenidoSchema,
  titulo: z.string(),
  anio: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  generos: z.array(z.object({ id: z.number().int(), nombre: z.string() })),
  promedio: z.number().nullable(),
  calificaciones: z.number().int(),
  origen: OrigenRecomendacionSchema,
});

export type RecomendacionComunidad = z.infer<typeof RecomendacionComunidadSchema>;

export const RecomendacionesComunidadQuerySchema = z.object({
  generoId: z.coerce.number().int().positive().optional(),
  tipo: TipoContenidoSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type RecomendacionesComunidadQuery = z.infer<typeof RecomendacionesComunidadQuerySchema>;

export const PaginaRecomendacionesComunidadSchema = z.object({
  items: z.array(RecomendacionComunidadSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
