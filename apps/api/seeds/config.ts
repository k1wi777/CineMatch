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
  return { correo, username, contrasena };
}
