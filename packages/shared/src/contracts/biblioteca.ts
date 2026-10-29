import { z } from "zod";
import { GeneroRefSchema, TipoContenidoSchema } from "./catalogo.js";

// Estados de seguimiento de un título en la biblioteca (RF14).
export const ESTADOS_BIBLIOTECA = ["pendiente", "viendo", "vista", "abandonada"] as const;
export const EstadoBibliotecaSchema = z.enum(ESTADOS_BIBLIOTECA);

export type EstadoBiblioteca = z.infer<typeof EstadoBibliotecaSchema>;

// Cuerpo de PUT /library/:contentId.
export const EstablecerEstadoSchema = z.object({
  estado: EstadoBibliotecaSchema,
});

export type EstablecerEstado = z.infer<typeof EstablecerEstadoSchema>;

const ORDENES = ["fecha", "titulo"] as const;
const DIRECCIONES = ["asc", "desc"] as const;

// Filtros y orden de GET /library (BE-8.2).
export const BibliotecaQuerySchema = z.object({
  estado: EstadoBibliotecaSchema.optional(),
  tipo: TipoContenidoSchema.optional(),
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
    .pipe(z.array(z.number().int().positive()).max(50).optional()),
  orden: z.enum(ORDENES).default("fecha"),
  dir: z.enum(DIRECCIONES).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type BibliotecaQuery = z.infer<typeof BibliotecaQuerySchema>;

export const ElementoBibliotecaSchema = z.object({
  id: z.number().int(),
  tipo: TipoContenidoSchema,
  titulo: z.string(),
  anio: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  generos: z.array(GeneroRefSchema),
  estado: EstadoBibliotecaSchema,
  fechaActualizacion: z.string(),
});

export type ElementoBiblioteca = z.infer<typeof ElementoBibliotecaSchema>;

// Conteo por pestaña de estado. Respeta tipo y géneros, pero no el filtro de estado.
export const ConteosBibliotecaSchema = z.object({
  pendiente: z.number().int(),
  viendo: z.number().int(),
  vista: z.number().int(),
  abandonada: z.number().int(),
  total: z.number().int(),
});

export type ConteosBiblioteca = z.infer<typeof ConteosBibliotecaSchema>;

export const PaginaBibliotecaSchema = z.object({
  items: z.array(ElementoBibliotecaSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  conteos: ConteosBibliotecaSchema,
});

export type PaginaBiblioteca = z.infer<typeof PaginaBibliotecaSchema>;

// Estado de un título para el usuario de la sesión (GET /library/:contentId). null si no está en su biblioteca.
export const EstadoActualBibliotecaSchema = z.object({
  estado: EstadoBibliotecaSchema.nullable(),
});

export type EstadoActualBiblioteca = z.infer<typeof EstadoActualBibliotecaSchema>;
