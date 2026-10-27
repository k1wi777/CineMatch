import { z } from "zod";

// Género de interés: lo que devuelve GET /genres.
export const GeneroSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
});

export type Genero = z.infer<typeof GeneroSchema>;

// Géneros de interés del usuario: al menos 3 distintos (RN13). Lo usan el registro y los intereses.
export const GenerosInteresSchema = z
  .array(z.number().int().positive())
  .min(3, "Elige al menos 3 géneros de interés.")
  .refine((ids) => new Set(ids).size === ids.length, "No repitas géneros.");

export const ActualizarInteresesSchema = z.object({
  generoIds: GenerosInteresSchema,
});

export type ActualizarIntereses = z.infer<typeof ActualizarInteresesSchema>;
