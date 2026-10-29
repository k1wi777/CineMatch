import { z } from "zod";
import { PaginationQuerySchema } from "./paginacion.js";

export const TIPOS_CONTENIDO = ["pelicula", "serie"] as const;
export const TipoContenidoSchema = z.enum(TIPOS_CONTENIDO);

export type TipoContenido = z.infer<typeof TipoContenidoSchema>;

// Género con su id: la web lo usa para filtrar y para mostrarlo.
export const GeneroRefSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
});

export type GeneroRef = z.infer<typeof GeneroRefSchema>;

// Búsqueda y filtros del catálogo (BE-6.4): ?q=&tipo=&generoIds=1,2&page=&pageSize=.
export const CatalogoQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  tipo: TipoContenidoSchema.optional(),
  // Lista separada por comas. Un título coincide si tiene al menos uno de los géneros indicados.
  generoIds: z
    .string()
    .optional()
    .transform((valor) =>
      valor
        ? valor
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
            .map((id) => Number(id))
        : undefined,
    )
    .pipe(
      z
        .array(z.number().int().positive())
        .max(50, "No puedes filtrar por más de 50 géneros.")
        .optional(),
    ),
});

export type CatalogoQuery = z.infer<typeof CatalogoQuerySchema>;

// Elemento del listado: lo necesario para mostrar una tarjeta.
export const CatalogoItemSchema = z.object({
  id: z.number().int(),
  tipo: TipoContenidoSchema,
  titulo: z.string(),
  anio: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  generos: z.array(GeneroRefSchema),
});

export type CatalogoItem = z.infer<typeof CatalogoItemSchema>;

export const CatalogoPaginaSchema = z.object({
  items: z.array(CatalogoItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

// Ficha base (BE-6.5). Las secciones de calificación, etiquetas y reseñas se añaden después sin cambiar estos campos.
export const TituloFichaSchema = z.object({
  id: z.number().int(),
  tipo: TipoContenidoSchema,
  titulo: z.string(),
  sinopsis: z.string().nullable(),
  anio: z.number().int().nullable(),
  director: z.string().nullable(),
  duracion: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  popularidadExterna: z.number().nullable(),
  generos: z.array(GeneroRefSchema),
  fechaActualizacion: z.string(),
});

export type TituloFicha = z.infer<typeof TituloFichaSchema>;

// Enlace al tráiler de YouTube, o null si el título no tiene uno.
export const TrailerSchema = z.object({
  url: z.string().url().nullable(),
});

export type Trailer = z.infer<typeof TrailerSchema>;
