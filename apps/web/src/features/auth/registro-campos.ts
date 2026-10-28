import { RegistroSchema } from "@cinematch/shared";
import { z } from "zod";

// Campos del paso 1 del registro. El paso 2 solo tiene los géneros.
export const CAMPOS_PASO_1 = ["nombre", "username", "correo", "contrasena", "aceptaDatos"] as const;

export const MINIMO_GENEROS = 3;

// Esquema del formulario: el de la API, con la casilla de autorización como booleano
// para que el checkbox pueda enlazarse. Al enviar se convierte a `true`.
export const REGISTRO_FORMULARIO = RegistroSchema.extend({
  aceptaDatos: z.boolean().refine((valor) => valor, {
    message: "Debes aceptar el tratamiento de tus datos.",
  }),
});

export type FormularioRegistro = z.infer<typeof REGISTRO_FORMULARIO>;

// Requisitos visibles de la contraseña. Deben coincidir con PasswordSchema de packages/shared.
export function requisitosContrasena(valor: string) {
  return [
    { clave: "requisitoLongitud", cumple: valor.length >= 8 },
    { clave: "requisitoLetra", cumple: /[A-Za-z]/.test(valor) },
    { clave: "requisitoNumero", cumple: /\d/.test(valor) },
  ] as const;
}
