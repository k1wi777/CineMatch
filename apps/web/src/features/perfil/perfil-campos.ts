import { BioSchema, NombreSchema, PasswordSchema, UsernameSchema } from "@cinematch/shared";
import { z } from "zod";

// Datos editables del perfil. La bio vacía se envía como null (la API la borra).
export const FORMULARIO_DATOS = z.object({
  nombre: NombreSchema,
  username: UsernameSchema,
  bio: BioSchema,
});

export type FormularioDatos = z.input<typeof FORMULARIO_DATOS>;

export const BIO_MAXIMA = 300;

// Cambio de contraseña: la actual, la nueva con la política y su confirmación.
export const FORMULARIO_CONTRASENA = z
  .object({
    contrasenaActual: z.string().min(1, "Escribe tu contraseña actual."),
    contrasenaNueva: PasswordSchema,
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasenaNueva === datos.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export type FormularioContrasena = z.infer<typeof FORMULARIO_CONTRASENA>;
