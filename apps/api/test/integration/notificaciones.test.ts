import type { Notificacion } from "@cinematch/shared";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearRecomendacion,
  crearResena,
  crearUsuario,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";
import {
  crearServicioCreacion,
  type EmisorNotificaciones,
} from "../../src/modules/notificaciones/notificaciones.creacion.js";
import { withTransaction } from "../../src/lib/db.js";

const ORIGEN = "http://localhost:3000";
const CORREO_DESTINO = "notif.destino@cinematch.test";
const CORREO_OTRO = "notif.otro@cinematch.test";
const CONTRASENA = "Clave1234";

function login(app: ReturnType<typeof buildTestApp>, correo: string) {
  return request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGEN)
    .send({ correo, contrasena: CONTRASENA });
}

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

function emisorEspia() {
  const emitidas: { destinatarioId: number; notificacion: Notificacion }[] = [];
  const emisor: EmisorNotificaciones = {
    emitir(destinatarioId, notificacion) {
      emitidas.push({ destinatarioId, notificacion });
    },
  };
  return { emisor, emitidas };
}

describe("notificaciones (BE-5.1 y BE-5.2)", () => {
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

  describe("servicio de creación (BE-5.1)", () => {
    it("crea cada uno de los 6 tipos con su referencia correcta", async () => {
      const destino = await crearUsuario(pool, "destino_tipos");
      const origen = await crearUsuario(pool, "origen_tipos_o");
      const contenido = await crearContenido(pool, "pelicula", "tipos-1");
      const amistad = await crearAmistad(pool, origen, destino);
      const recomendacion = await crearRecomendacion(pool, origen, destino, contenido);
      const resena = await crearResena(pool, origen, contenido);
      const servicio = crearServicioCreacion();

      const casos = [
        { tipo: "recomendacion_recibida", referencia: { recomendacionId: recomendacion } },
        { tipo: "recomendacion_aceptada", referencia: { recomendacionId: recomendacion } },
        { tipo: "recomendacion_completada", referencia: { recomendacionId: recomendacion } },
        { tipo: "solicitud_amistad", referencia: { amistadId: amistad } },
        { tipo: "amistad_aceptada", referencia: { amistadId: amistad } },
        { tipo: "resena_oculta", referencia: { resenaId: resena } },
      ] as const;

      for (const caso of casos) {
        const creada = await withTransaction(pool, (tx) =>
          servicio.crear(tx, { ...caso, destinatarioId: destino, origenId: origen }),
        );
        expect(creada.tipo).toBe(caso.tipo);
      }
      const total = await pool.query(
        "SELECT count(*) FROM notificacion WHERE usuario_destinatario_id = $1",
        [destino],
      );
      expect(Number(total.rows[0]?.count)).toBe(6);
    });

    it("rechaza una referencia que no corresponde al tipo", async () => {
      const destino = await crearUsuario(pool, "destino_mal");
      const origen = await crearUsuario(pool, "origen_mal_o");
      const amistad = await crearAmistad(pool, origen, destino);
      const servicio = crearServicioCreacion();

      await expect(
        withTransaction(pool, (tx) =>
          servicio.crear(tx, {
            tipo: "recomendacion_recibida",
            destinatarioId: destino,
            origenId: origen,
            referencia: { amistadId: amistad },
          }),
        ),
      ).rejects.toThrow(/recomendacionId/);
    });

    it("rechaza dos referencias o ninguna", async () => {
      const destino = await crearUsuario(pool, "destino_dos");
      const origen = await crearUsuario(pool, "origen_dos_o");
      const amistad = await crearAmistad(pool, origen, destino);
      const contenido = await crearContenido(pool, "pelicula", "dos-1");
      const recomendacion = await crearRecomendacion(pool, origen, destino, contenido);
      const servicio = crearServicioCreacion();

      await expect(
        withTransaction(pool, (tx) =>
          servicio.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: destino,
            referencia: { amistadId: amistad, recomendacionId: recomendacion },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withTransaction(pool, (tx) =>
          servicio.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: destino,
            referencia: {},
          }),
        ),
      ).rejects.toThrow();
    });

    it("si la transacción del llamador revierte, la notificación desaparece", async () => {
      const destino = await crearUsuario(pool, "destino_rollback");
      const origen = await crearUsuario(pool, "origen_rollback_o");
      const amistad = await crearAmistad(pool, origen, destino);
      const servicio = crearServicioCreacion();

      await expect(
        withTransaction(pool, async (tx) => {
          await servicio.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: destino,
            origenId: origen,
            referencia: { amistadId: amistad },
          });
          throw new Error("el módulo que la origina falló");
        }),
      ).rejects.toThrow("el módulo que la origina falló");

      const { rows } = await pool.query("SELECT count(*) FROM notificacion");
      expect(Number(rows[0]?.count)).toBe(0);
    });

    it("la emisión en vivo ocurre solo tras el COMMIT", async () => {
      const destino = await crearUsuario(pool, "destino_commit");
      const origen = await crearUsuario(pool, "origen_commit_o");
      const amistad = await crearAmistad(pool, origen, destino);
      const { emisor, emitidas } = emisorEspia();
      const servicio = crearServicioCreacion({ emisor });

      await withTransaction(pool, async (tx) => {
        await servicio.crear(tx, {
          tipo: "solicitud_amistad",
          destinatarioId: destino,
          origenId: origen,
          referencia: { amistadId: amistad },
        });
        expect(emitidas).toHaveLength(0);
      });

      expect(emitidas).toHaveLength(1);
      expect(emitidas[0]?.destinatarioId).toBe(destino);
    });

    it("no emite nada si la transacción revierte", async () => {
      const destino = await crearUsuario(pool, "destino_no_emite");
      const origen = await crearUsuario(pool, "origen_no_emite_o");
      const amistad = await crearAmistad(pool, origen, destino);
      const { emisor, emitidas } = emisorEspia();
      const servicio = crearServicioCreacion({ emisor });

      await expect(
        withTransaction(pool, async (tx) => {
          await servicio.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: destino,
            origenId: origen,
            referencia: { amistadId: amistad },
          });
          throw new Error("revierte");
        }),
      ).rejects.toThrow("revierte");

      expect(emitidas).toHaveLength(0);
    });
  });

  describe("lectura (BE-5.2)", () => {
    // Crea `total` notificaciones de solicitud de amistad para el destinatario.
    // Cada notificación tiene su propio origen: el par de una amistad es único en la base.
    async function sembrarNotificaciones(destino: number, total: number) {
      const servicio = crearServicioCreacion();
      for (let i = 0; i < total; i++) {
        const origen = await crearUsuario(pool, `origen_${destino}_${i}`);
        const amistad = await crearAmistad(pool, origen, destino);
        await withTransaction(pool, (tx) =>
          servicio.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: destino,
            origenId: origen,
            referencia: { amistadId: amistad },
          }),
        );
      }
    }

    it("exige sesión (401 sin cookie)", async () => {
      const app = buildTestApp(pool);

      const res = await request(app).get("/api/notifications");

      expect(res.status).toBe(401);
    });

    it("lista paginada, más recientes primero, con origen y target", async () => {
      await crearUsuarioConContrasena(pool, "destino_lista", CORREO_DESTINO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_lista'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 3);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_DESTINO));

      const res = await request(app).get("/api/notifications?pageSize=2").set("Cookie", sesion);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].id).toBeGreaterThan(res.body.items[1].id);
      expect(res.body.items[0]).toMatchObject({
        tipo: "solicitud_amistad",
        leida: false,
        fechaLectura: null,
        origen: { username: expect.stringMatching(/^origen_\d+_\d+$/), avatarUrl: null },
        target: { tipo: "amistad", id: expect.any(Number) },
      });
    });

    it("la página siguiente trae el resto sin repetir", async () => {
      await crearUsuarioConContrasena(pool, "destino_paginas", CORREO_DESTINO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_paginas'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 3);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_DESTINO));

      const primera = await request(app)
        .get("/api/notifications?pageSize=2&page=1")
        .set("Cookie", sesion);
      const segunda = await request(app)
        .get("/api/notifications?pageSize=2&page=2")
        .set("Cookie", sesion);

      const ids = [...primera.body.items, ...segunda.body.items].map((n: Notificacion) => n.id);
      expect(segunda.body.items).toHaveLength(1);
      expect(new Set(ids).size).toBe(3);
    });

    it("soloNoLeidas filtra y el contador de no leídas coincide", async () => {
      await crearUsuarioConContrasena(pool, "destino_filtro", CORREO_DESTINO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_filtro'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 3);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_DESTINO));
      const primera = await request(app).get("/api/notifications").set("Cookie", sesion);
      await request(app)
        .patch(`/api/notifications/${primera.body.items[0].id}/read`)
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);

      const noLeidas = await request(app)
        .get("/api/notifications?soloNoLeidas=true")
        .set("Cookie", sesion);
      const contador = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", sesion);

      expect(noLeidas.body.total).toBe(2);
      expect(noLeidas.body.items.every((n: Notificacion) => !n.leida)).toBe(true);
      expect(contador.body.noLeidas).toBe(2);
    });

    it("marcar como leída actualiza el contador y repetirlo no cambia nada", async () => {
      await crearUsuarioConContrasena(pool, "destino_leer", CORREO_DESTINO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_leer'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 1);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_DESTINO));
      const { id } = (await request(app).get("/api/notifications").set("Cookie", sesion)).body
        .items[0];

      const primera = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);
      const fechaPrimera = (
        await pool.query("SELECT fecha_lectura FROM notificacion WHERE id = $1", [id])
      ).rows[0];
      const segunda = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);
      const fechaSegunda = (
        await pool.query("SELECT fecha_lectura FROM notificacion WHERE id = $1", [id])
      ).rows[0];
      const contador = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", sesion);

      expect(primera.status).toBe(204);
      expect(segunda.status).toBe(204);
      expect(fechaSegunda.fecha_lectura).toEqual(fechaPrimera.fecha_lectura);
      expect(contador.body.noLeidas).toBe(0);
    });

    it("solo el destinatario puede marcarla: a otro le responde 404 y no cambia nada", async () => {
      await crearUsuarioConContrasena(pool, "destino_ajeno", CORREO_DESTINO, CONTRASENA);
      await crearUsuarioConContrasena(pool, "otro_ajeno", CORREO_OTRO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_ajeno'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 1);
      const app = buildTestApp(pool);
      const sesionDestino = cookieDe(await login(app, CORREO_DESTINO));
      const sesionOtro = cookieDe(await login(app, CORREO_OTRO));
      const { id } = (await request(app).get("/api/notifications").set("Cookie", sesionDestino))
        .body.items[0];

      const ajena = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set("Origin", ORIGEN)
        .set("Cookie", sesionOtro);
      const contador = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", sesionDestino);

      expect(ajena.status).toBe(404);
      expect(contador.body.noLeidas).toBe(1);
    });

    it("read-all marca todas las del usuario y no toca las ajenas", async () => {
      await crearUsuarioConContrasena(pool, "destino_todas", CORREO_DESTINO, CONTRASENA);
      await crearUsuarioConContrasena(pool, "otro_todas", CORREO_OTRO, CONTRASENA);
      const destino = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'destino_todas'")).rows[0]?.id,
      );
      const otro = Number(
        (await pool.query("SELECT id FROM usuario WHERE username = 'otro_todas'")).rows[0]?.id,
      );
      await sembrarNotificaciones(destino, 2);
      await sembrarNotificaciones(otro, 1);
      const app = buildTestApp(pool);
      const sesionDestino = cookieDe(await login(app, CORREO_DESTINO));
      const sesionOtro = cookieDe(await login(app, CORREO_OTRO));

      const res = await request(app)
        .post("/api/notifications/read-all")
        .set("Origin", ORIGEN)
        .set("Cookie", sesionDestino);
      const contadorDestino = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", sesionDestino);
      const contadorOtro = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", sesionOtro);

      expect(res.status).toBe(204);
      expect(contadorDestino.body.noLeidas).toBe(0);
      expect(contadorOtro.body.noLeidas).toBe(1);
    });

    it("valida la paginación y el id con 422", async () => {
      await crearUsuarioConContrasena(pool, "destino_valida", CORREO_DESTINO, CONTRASENA);
      const app = buildTestApp(pool);
      const sesion = cookieDe(await login(app, CORREO_DESTINO));

      const pagina = await request(app).get("/api/notifications?pageSize=51").set("Cookie", sesion);
      const idInvalido = await request(app)
        .patch("/api/notifications/abc/read")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);

      expect(pagina.status).toBe(422);
      expect(idInvalido.status).toBe(422);
    });
  });
});
