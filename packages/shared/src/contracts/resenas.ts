import { z } from "zod";

export const VISIBILIDADES_RESENA = ["publica", "amigos"] as const;
export const VisibilidadResenaSchema = z.enum(VISIBILIDADES_RESENA);

// Reseña en listas de perfil y de título: el contenido solo aparece en las listas de usuario.
export const ResenaListaSchema = z.object({
  id: z.number().int(),
  calificacion: z.number(),
  etiquetas: z.array(z.string()),
  comentario: z.string().nullable(),
  esSpoiler: z.boolean(),
  visibilidad: VisibilidadResenaSchema,
  fechaCreacion: z.string(),
  fechaEdicion: z.string().nullable(),
  autor: z.object({
    id: z.number().int(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  contenido: z
    .object({
      id: z.number().int(),
      titulo: z.string(),
      posterUrl: z.string().nullable(),
    })
    .optional(),
});

export type ResenaLista = z.infer<typeof ResenaListaSchema>;

export type VisibilidadResena = z.infer<typeof VisibilidadResenaSchema>;

export const MAX_ETIQUETAS_RESENA = 5;
export const MAX_LONGITUD_ETIQUETA = 30;
export const MAX_COMENTARIO = 2000;

// Calificación de 1 a 5 en pasos de 0,5 (RN1 y ERS).
export const CalificacionSchema = z
  .number()
  .min(1, "La calificación mínima es 1.")
  .max(5, "La calificación máxima es 5.")
  .refine((valor) => Number.isInteger(valor * 2), "La calificación avanza de medio en medio.");

// Quita etiquetas HTML y normaliza espacios, pero conserva los saltos de línea del comentario.
const quitarEtiquetasComentario = (valor: string) =>
  valor
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

export const ComentarioSchema = z
  .string()
  .transform(quitarEtiquetasComentario)
  .pipe(
    z.string().max(MAX_COMENTARIO, `El comentario no puede superar ${MAX_COMENTARIO} caracteres.`),
  );

// Forma canónica de una etiqueta (RN6): minúsculas, sin tildes, espacios colapsados.
// Se usa al guardar y debe dar siempre el mismo resultado para el mismo texto.
export function normalizarEtiqueta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Escribir o editar la reseña de un título (RN1). Una por usuario y título: PUT crea o actualiza.
export const EscribirResenaSchema = z.object({
  calificacion: CalificacionSchema,
  comentario: ComentarioSchema.nullable().optional(),
  visibilidad: VisibilidadResenaSchema.default("publica"),
  esSpoiler: z.boolean().default(false),
  // Lista de texto libre. Se normaliza, se descartan vacías y repetidas, y se limita en el servicio.
  etiquetas: z.array(z.string().max(100)).max(20).default([]),
});

export type EscribirResena = z.infer<typeof EscribirResenaSchema>;

export const ResenaSchema = z.object({
  id: z.number().int(),
  contenidoId: z.number().int(),
  calificacion: z.number(),
  comentario: z.string().nullable(),
  visibilidad: VisibilidadResenaSchema,
  esSpoiler: z.boolean(),
  etiquetas: z.array(z.string()),
  fechaCreacion: z.string(),
  fechaEdicion: z.string().nullable(),
});

export type Resena = z.infer<typeof ResenaSchema>;
