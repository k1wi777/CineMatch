import { PasswordSchema } from "@cinematch/shared";
import { z } from "zod";

// Formulario de nueva contraseña: la política de la API más la confirmación.
export const FORMULARIO_RESTABLECER = z
  .object({
    contrasena: PasswordSchema,
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export type FormularioRestablecer = z.infer<typeof FORMULARIO_RESTABLECER>;
