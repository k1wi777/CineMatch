import type { Notificacion } from "@cinematch/shared";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearAmistad, crearUsuario, crearUsuarioConContrasena } from "../helpers/fixtures.js";
import { withTransaction } from "../../src/lib/db.js";
import {
  crearServicioCreacion,
  type EmisorNotificaciones,
} from "../../src/modules/notificaciones/notificaciones.creacion.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "persistencia@cinematch.test";
const CONTRASENA = "Clave1234";

function login(app: ReturnType<typeof buildTestApp>) {
  return request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGEN)
    .send({ correo: CORREO, contrasena: CONTRASENA });
}

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

// Crea una solicitud de amistad para `destino` a través del servicio real, con el emisor indicado.
async function notificar(
  pool: pg.Pool,
  destino: number,
  emisor: EmisorNotificaciones,
  etiqueta: string,
): Promise<Notificacion> {
  const origen = await crearUsuario(pool, `origen_${etiqueta}`);
  const amistad = await crearAmistad(pool, origen, destino);
  const servicio = crearServicioCreacion({ emisor });
  return withTransaction(pool, (tx) =>
    servicio.crear(tx, {
      tipo: "solicitud_amistad",
      destinatarioId: destino,
      origenId: origen,
      referencia: { amistadId: amistad },
    }),
  );
}

const EMISOR_SILENCIOSO: EmisorNotificaciones = { emitir() {} };

describe("persistencia de notificaciones (BE-5.4)", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("flujo desconectado: se guarda aunque nadie esté conectado y aparece al iniciar sesión", async () => {
    const destino = await crearUsuarioConContrasena(pool, "persiste_offline", CORREO, CONTRASENA);
    const app = buildTestApp(pool);
    // Sin ninguna sesión abierta: la notificación solo existe en la base de datos.
    const creada = await notificar(pool, destino, EMISOR_SILENCIOSO, "offline");

    const sesion = cookieDe(await login(app));
    const lista = await request(app).get("/api/notifications").set("Cookie", sesion);
    const contador = await request(app)
      .get("/api/notifications/unread-count")
      .set("Cookie", sesion);

    expect(lista.body.total).toBe(1);
    expect(lista.body.items[0]).toMatchObject({
      id: creada.id,
      tipo: "solicitud_amistad",
      leida: false,
      target: { tipo: "amistad" },
    });
    expect(contador.body.noLeidas).toBe(1);
  });

  it("flujo desconectado: varias notificaciones de la ausencia llegan todas, más recientes primero", async () => {
    const destino = await crearUsuarioConContrasena(pool, "persiste_varias", CORREO, CONTRASENA);
    const primera = await notificar(pool, destino, EMISOR_SILENCIOSO, "varias_1");
    const segunda = await notificar(pool, destino, EMISOR_SILENCIOSO, "varias_2");
    const app = buildTestApp(pool);

    const sesion = cookieDe(await login(app));
    const lista = await request(app).get("/api/notifications").set("Cookie", sesion);

    expect(lista.body.items.map((n: Notificacion) => n.id)).toEqual([segunda.id, primera.id]);
  });

  it("flujo conectado: la notificación emitida en vivo es la misma que queda guardada", async () => {
    const destino = await crearUsuarioConContrasena(pool, "persiste_vivo", CORREO, CONTRASENA);
    const emitidas: Notificacion[] = [];
    const creada = await notificar(pool, destino, { emitir: (_, n) => emitidas.push(n) }, "vivo");
    const app = buildTestApp(pool);

    const sesion = cookieDe(await login(app));
    const lista = await request(app).get("/api/notifications").set("Cookie", sesion);

    expect(emitidas).toEqual([creada]);
    expect(lista.body.items[0]).toEqual(creada);
  });

  it("flujo conectado: lo leído en una pestaña sale del contador en otra sesión del mismo usuario", async () => {
    const destino = await crearUsuarioConContrasena(pool, "persiste_leer", CORREO, CONTRASENA);
    const creada = await notificar(pool, destino, EMISOR_SILENCIOSO, "leer");
    const app = buildTestApp(pool);
    const pestana = cookieDe(await login(app));
    const otraPestana = cookieDe(await login(app));

    await request(app)
      .patch(`/api/notifications/${creada.id}/read`)
      .set("Origin", ORIGEN)
      .set("Cookie", pestana);
    const contador = await request(app)
      .get("/api/notifications/unread-count")
      .set("Cookie", otraPestana);

    expect(contador.body.noLeidas).toBe(0);
  });
});
