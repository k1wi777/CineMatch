import { z } from "zod";
import { REGLAS_DE_NEGOCIO_SCHEMA } from "./business-rules.js";

const envBase = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url(),
  // Aplica las migraciones pendientes al arrancar. Pensado para desarrollo local.
  MIGRATE_ON_START: z.stringbool().default(false),
  // Origen de la web: CORS, validación de CSRF y enlaces de correo. Obligatorio en producción.
  WEB_URL: z.url().default("http://localhost:3000"),
  // Confiar en el proxy que reenvía la IP del cliente (necesario detrás de un balanceador).
  TRUST_PROXY: z.stringbool().default(false),
  // Correo saliente: Mailpit en desarrollo (SMTP 1025).
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().min(1).default("CineMatch <no-reply@cinematch.local>"),
  // Clave de TMDB (BE-6). Vacía o ausente: el catálogo usa el proveedor de prueba, sin red.
  TMDB_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor : undefined)),
  // Sincronización periódica del catálogo (BE-6.3). Desactivada por defecto.
  CATALOGO_SYNC_HABILITADA: z.stringbool().default(false),
  CATALOGO_SYNC_CRON: z.string().trim().min(1).default("0 3 * * 0"),
});

const envSchema = envBase.extend(REGLAS_DE_NEGOCIO_SCHEMA.shape).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && env.WEB_URL === "http://localhost:3000") {
    ctx.addIssue({
      code: "custom",
      path: ["WEB_URL"],
      message: "WEB_URL debe definirse explícitamente en producción",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Solo se nombran las variables: nunca se muestran sus valores.
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Variables de entorno inválidas o ausentes: ${names.join(", ")}`);
  }
  return result.data;
}
