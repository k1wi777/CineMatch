import { z } from "zod";

export const RECOMMENDATION_STATUSES = [
  "enviada",
  "abierta",
  "aceptada",
  "descartada",
  "completada",
] as const;

export const RecommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);

export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

// Acciones sobre una recomendación. Qué transición producen lo decide BE-10.1, no este paquete.
export const RECOMMENDATION_ACTIONS = ["OPEN", "ACCEPT", "DISCARD", "COMPLETE"] as const;

export const RecommendationActionSchema = z.enum(RECOMMENDATION_ACTIONS);

export type RecommendationAction = z.infer<typeof RecommendationActionSchema>;
