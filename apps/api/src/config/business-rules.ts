import { z } from "zod";
import type { Env } from "./env.js";

// Reglas de negocio parametrizables. Los valores por defecto son los del ERS.
// Cada servicio las importa desde aquí: ningún número de regla se escribe en un servicio.
export const REGLAS_DE_NEGOCIO_SCHEMA = z.object({
  // Etiquetas de la comunidad: una etiqueta aparece si la usan al menos N reseñas públicas (RN7).
  TAG_MIN_REVIEWS: z.coerce.number().int().min(1).default(3),
  // Recomendaciones generales: un título necesita al menos N calificaciones para entrar al ranking (RN15).
  COMMUNITY_MIN_RATINGS: z.coerce.number().int().min(1).default(5),
  // Caché del ranking de la comunidad, que se precalcula cada hora (RN15).
  COMMUNITY_CACHE_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
  // Sesión: expira tras este tiempo sin actividad (deslizante).
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).default(30),
  // Sesión: tope absoluto desde el login, aunque haya actividad (BE-3.2).
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).default(7),
  // Sesión: la última actividad solo se guarda si pasó este tiempo (BE-3.2).
  SESSION_TOUCH_SECONDS: z.coerce.number().int().min(1).default(60),
  // Bloqueo de cuenta tras N intentos fallidos de inicio de sesión (RNF de seguridad).
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
  // Enlace de recuperación de contraseña: vence a la hora y es de un solo uso (RF4).
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
});

export type ReglasDeNegocio = z.infer<typeof REGLAS_DE_NEGOCIO_SCHEMA>;

export function reglasDeNegocio(env: Env): ReglasDeNegocio {
  return {
    TAG_MIN_REVIEWS: env.TAG_MIN_REVIEWS,
    COMMUNITY_MIN_RATINGS: env.COMMUNITY_MIN_RATINGS,
    COMMUNITY_CACHE_TTL_MINUTES: env.COMMUNITY_CACHE_TTL_MINUTES,
    SESSION_IDLE_MINUTES: env.SESSION_IDLE_MINUTES,
    SESSION_ABSOLUTE_DAYS: env.SESSION_ABSOLUTE_DAYS,
    SESSION_TOUCH_SECONDS: env.SESSION_TOUCH_SECONDS,
    LOGIN_MAX_ATTEMPTS: env.LOGIN_MAX_ATTEMPTS,
    LOGIN_LOCK_MINUTES: env.LOGIN_LOCK_MINUTES,
    RESET_TOKEN_TTL_MINUTES: env.RESET_TOKEN_TTL_MINUTES,
  };
}
