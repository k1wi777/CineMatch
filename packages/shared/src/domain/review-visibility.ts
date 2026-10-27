import { z } from "zod";

// Visibilidad elegida por el autor. La moderación (reseña oculta) es un estado aparte.
export const REVIEW_VISIBILITIES = ["publica", "amigos"] as const;

export const ReviewVisibilitySchema = z.enum(REVIEW_VISIBILITIES);

export type ReviewVisibility = z.infer<typeof ReviewVisibilitySchema>;
