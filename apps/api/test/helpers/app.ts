import pino from "pino";
import type pg from "pg";
import { createApp } from "../../src/app.js";
import type { OpcionesDeSeguridad } from "../../src/config/security.js";

const silentLogger = pino({ level: "silent" });

// Opciones de seguridad para pruebas: origen conocido y límites altos para no estorbar a cada test.
export const SEGURIDAD_DE_PRUEBA: OpcionesDeSeguridad = {
  webUrl: "http://localhost:3000",
  trustProxy: false,
  jsonLimite: "100kb",
  limites: {
    general: { ventanaMs: 60_000, max: 10_000 },
    auth: { ventanaMs: 60_000, max: 10_000 },
  },
};

// Aplicación Express real, sin abrir puerto: Supertest la monta directamente.
export function buildTestApp(
  pool: pg.Pool,
  seguridad: OpcionesDeSeguridad = SEGURIDAD_DE_PRUEBA,
  documentacion = true,
) {
  return createApp({ pool, logger: silentLogger, seguridad, documentacion });
}
