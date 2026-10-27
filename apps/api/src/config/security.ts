import type { Env } from "./env.js";

export type OpcionesDeSeguridad = {
  // Único origen permitido para CORS y para la validación de CSRF.
  webUrl: string;
  trustProxy: boolean;
  // Tamaño máximo del cuerpo JSON. Las subidas de archivos tienen su propio límite (BE-4.4).
  jsonLimite: string;
  limites: {
    general: { ventanaMs: number; max: number };
    auth: { ventanaMs: number; max: number };
  };
};

const MINUTO_MS = 60_000;

// Desarrollo es más permisivo para no estorbar al trabajar; producción aplica los límites reales.
export function opcionesDeSeguridad(env: Env): OpcionesDeSeguridad {
  const produccion = env.NODE_ENV === "production";

  return {
    webUrl: env.WEB_URL,
    trustProxy: env.TRUST_PROXY,
    jsonLimite: "100kb",
    limites: {
      general: { ventanaMs: MINUTO_MS, max: produccion ? 120 : 1_000 },
      auth: { ventanaMs: 15 * MINUTO_MS, max: produccion ? 10 : 100 },
    },
  };
}
