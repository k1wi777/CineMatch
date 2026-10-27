import pino from "pino";
import type pg from "pg";
import { createApp } from "../../src/app.js";

const silentLogger = pino({ level: "silent" });

// Aplicación Express real, sin abrir puerto: Supertest la monta directamente.
export function buildTestApp(pool: pg.Pool) {
  return createApp({ pool, logger: silentLogger });
}
