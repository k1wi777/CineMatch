import { z } from "zod";
import { RecommendationStatusSchema } from "../domain/recommendation.js";

export const MAX_MOTIVO_RECOMENDACION = 500;

// Enviar una recomendación de un título a un amigo (BE-10.3).
export const EnviarRecomendacionSchema = z.object({
  contentId: z.number().int().positive(),
  amigoId: z.number().int().positive(),
  motivo: z.string().max(2000).nullable().optional(),
  resenaId: z.number().int().positive().nullable().optional(),
});

export type EnviarRecomendacion = z.infer<typeof EnviarRecomendacionSchema>;

// Amigo al que se puede recomendar un título (BE-10.2). Los no seleccionables llevan la razón en las marcas.
export const AmigoRecomendableSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  generosEnComun: z.number().int(),
  fueraDeIntereses: z.boolean(),
  yaLaVio: z.boolean(),
  yaRecomendada: z.boolean(),
  seleccionable: z.boolean(),
});

export type AmigoRecomendable = z.infer<typeof AmigoRecomendableSchema>;

export const RecomendacionSchema = z.object({
  id: z.number().int(),
  contenidoId: z.number().int(),
  emisorId: z.number().int(),
  receptorId: z.number().int(),
  motivo: z.string().nullable(),
  resenaId: z.number().int().nullable(),
  fueraDeIntereses: z.boolean(),
  estado: RecommendationStatusSchema,
  fechaEnvio: z.string(),
});

export type Recomendacion = z.infer<typeof RecomendacionSchema>;

// Limpieza del motivo: sin etiquetas HTML ni espacios repetidos.
export function limpiarMotivo(texto: string): string | null {
  const limpio = texto
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  return limpio === "" ? null : limpio;
}
