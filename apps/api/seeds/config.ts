import { PasswordSchema } from "@cinematch/shared";

export type AdminSeed = {
  correo: string;
  username: string;
  contrasena: string;
};

const ADMIN_VARIABLES = ["ADMIN_EMAIL", "ADMIN_USERNAME", "ADMIN_PASSWORD"] as const;

// Lee el administrador inicial. Sin ninguna variable no se crea; con alguna incompleta, falla.
// Nunca muestra los valores: solo nombra las variables que faltan.
export function readAdminSeed(env: NodeJS.ProcessEnv = process.env): AdminSeed | null {
  const values = ADMIN_VARIABLES.map((name) => env[name]?.trim() || undefined);

  if (values.every((value) => value === undefined)) {
    return null;
  }

  const missing = ADMIN_VARIABLES.filter((_, index) => values[index] === undefined);
  if (missing.length > 0) {
    throw new Error(`Para crear el administrador define también: ${missing.join(", ")}`);
  }

  const [correo, username, contrasena] = values as [string, string, string];

  // El administrador sigue la misma política de contraseñas que cualquier usuario.
  const politica = PasswordSchema.safeParse(contrasena);
  if (!politica.success) {
    throw new Error(
      `ADMIN_PASSWORD no cumple la política de contraseñas: ${politica.error.issues[0]?.message ?? ""}`,
    );
  }
  return { correo, username, contrasena };
}
