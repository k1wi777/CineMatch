// Prueba de carga ligera (BE-13.3): ~100 conexiones concurrentes sobre catálogo, ficha y recomendaciones generales.
// Uso: pnpm carga  (desde apps/api). Requiere la base de desarrollo migrada y con catálogo (pnpm seed:catalog).
// Levanta la app en proceso con los límites de tasa de pruebas (el límite de desarrollo cortaría la carga con 429).
// Falla con código 1 si el promedio supera 2 s o hay respuestas no 2xx.

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import autocannon from "autocannon";
import pino from "pino";
import { createApp } from "../src/app.js";
import { reglasDeNegocio } from "../src/config/business-rules.js";
import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/lib/db.js";
import type { ServicioCorreo } from "../src/lib/correo.js";

const CONEXIONES = 100;
const DURACION_POR_RUTA_S = 10;
const PROMEDIO_MAXIMO_MS = 2000;
const CORREO = process.env.CARGA_CORREO ?? "demo_ana@demo.cinematch.local";
const CONTRASENA = process.env.CARGA_CONTRASENA ?? "Demo1234!";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: "silent" });
  const pool = createPool(env.DATABASE_URL);
  const correo: ServicioCorreo = { async enviarRecuperacion() {} };
  const app = createApp({
    pool,
    logger,
    seguridad: {
      webUrl: env.WEB_URL,
      trustProxy: false,
      jsonLimite: "100kb",
      limites: {
        general: { ventanaMs: 60_000, max: 1_000_000 },
        auth: { ventanaMs: 60_000, max: 1_000_000 },
      },
    },
    documentacion: false,
    reglas: reglasDeNegocio(env),
    produccion: false,
    correo,
  });
  const servidor = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: env.WEB_URL },
      body: JSON.stringify({ correo: CORREO, contrasena: CONTRASENA }),
    });
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    if (login.status !== 200 || !cookie) {
      throw new Error(`No se pudo iniciar sesión para la carga (estado ${login.status}).`);
    }

    const catalogo = await (
      await fetch(`${base}/api/catalog?pageSize=1`, { headers: { Cookie: cookie } })
    ).json();
    const idTitulo = catalogo.items[0]?.id;
    if (!idTitulo) {
      throw new Error("El catálogo está vacío: ejecuta pnpm seed:catalog antes de la carga.");
    }

    const rutas = [
      { nombre: "catálogo (listado)", path: "/api/catalog?pageSize=20&page=1" },
      { nombre: "catálogo (búsqueda)", path: "/api/catalog?q=drama&pageSize=20" },
      { nombre: "ficha del título", path: `/api/catalog/${idTitulo}` },
      { nombre: "recomendaciones generales", path: "/api/community/recommendations?pageSize=20" },
    ];

    let correcto = true;
    for (const ruta of rutas) {
      const resultado = await autocannon({
        url: base,
        connections: CONEXIONES,
        duration: DURACION_POR_RUTA_S,
        requests: [{ method: "GET", path: ruta.path, headers: { Cookie: cookie } }],
      });
      const promedio = resultado.latency.average;
      const noExitosas = resultado.non2xx;
      const ok = promedio <= PROMEDIO_MAXIMO_MS && noExitosas === 0 && resultado.errors === 0;
      correcto &&= ok;
      console.log(
        `${ruta.nombre}: promedio ${promedio} ms, p97.5 ${resultado.latency.p97_5} ms, ` +
          `peticiones ${resultado.requests.total}, no 2xx ${noExitosas}, errores ${resultado.errors} → ${ok ? "OK" : "FALLA"}`,
      );
    }
    if (!correcto) {
      process.exitCode = 1;
    }
  } finally {
    servidor.closeAllConnections();
    await new Promise<void>((resolver) => servidor.close(() => resolver()));
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
