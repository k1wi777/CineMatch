import { z } from "zod";

// Formato de error uniforme de la API (README, convenciones transversales).
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
