import { z } from "zod";

// Texto exacto que hay que escribir para eliminar la cuenta (lo exige también la API).
export const TEXTO_CONFIRMACION = "ELIMINAR";

export const FORMULARIO_ELIMINAR = z.object({
  contrasena: z.string().min(1, "Escribe tu contraseña."),
  // El retorno explícito evita que TypeScript infiera un predicado y estreche el campo al literal.
  confirmacion: z.string().refine((valor): boolean => valor === TEXTO_CONFIRMACION, {
    message: `Escribe ${TEXTO_CONFIRMACION} para confirmar.`,
  }),
});

export type FormularioEliminar = z.infer<typeof FORMULARIO_ELIMINAR>;
