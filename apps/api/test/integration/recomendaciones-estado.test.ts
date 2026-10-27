import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearContenido,
  crearRecomendacion,
  crearResena,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("recomendaciones recibidas, enviadas y su estado (BE-10.4, BE-10.5 y BE-10.7)", () => {
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

  // Emisor (Elena) recomienda un título a receptor (Rubén), con su sesión.
  async function escenario() {
    const titulo = await crearContenido(pool, "pelicula", "estado-reco-1");
    const emisor = await crearUsuarioConContrasena(
      pool,
      "elena_reco",
      "elena.reco@cinematch.test",
      CONTRASENA,
    );
    const receptor = await crearUsuarioConContrasena(
      pool,
      "ruben_reco",
      "ruben.reco@cinematch.test",
      CONTRASENA,
    );
    const recomendacion = await crearRecomendacion(pool, emisor, receptor, titulo);
    const a = buildTestApp(pool);
    const sesion = async (correo: string) =>
      cookieDe(
        await request(a)
          .post("/api/auth/login")
          .set("Origin", ORIGEN)
          .send({ correo, contrasena: CONTRASENA }),
      );
    return {
      a,
      titulo,
      emisor,
      receptor,
      recomendacion,
      cookieEmisor: await sesion("elena.reco@cinematch.test"),
      cookieReceptor: await sesion("ruben.reco@cinematch.test"),
    };
  }

  it("exige sesión", async () => {
    const a = buildTestApp(pool);

    const res = await request(a).get("/api/recommendations/received");

    expect(res.status).toBe(401);
  });

  describe("bandejas (BE-10.4 y BE-10.7)", () => {
    it("el receptor ve la recomendación en recibidas; el emisor, en enviadas, y se filtran por estado", async () => {
      const e = await escenario();

      const recibidas = await request(e.a)
        .get("/api/recommendations/received")
        .set("Cookie", e.cookieReceptor);
      const filtradas = await request(e.a)
        .get("/api/recommendations/received?estado=aceptada")
        .set("Cookie", e.cookieReceptor);
      const enviadas = await request(e.a)
        .get("/api/recommendations/sent")
        .set("Cookie", e.cookieEmisor);

      expect(recibidas.body.items.map((i: { id: number }) => i.id)).toEqual([e.recomendacion]);
      expect(recibidas.body.items[0]).toMatchObject({
        estado: "enviada",
        emisor: { id: e.emisor, username: "elena_reco" },
        contenido: { id: e.titulo },
      });
      expect(filtradas.body.total).toBe(0);
      expect(enviadas.body.items.map((i: { id: number }) => i.id)).toEqual([e.recomendacion]);
    });
  });

  describe("detalle y apertura (BE-10.4)", () => {
    it("el receptor que abre el detalle pasa la recomendación de enviada a abierta; el emisor no la abre", async () => {
      const e = await escenario();

      const delEmisor = await request(e.a)
        .get(`/api/recommendations/${e.recomendacion}`)
        .set("Cookie", e.cookieEmisor);
      const estadoTrasEmisor = await pool.query("SELECT estado FROM recomendacion WHERE id = $1", [
        e.recomendacion,
      ]);
      const delReceptor = await request(e.a)
        .get(`/api/recommendations/${e.recomendacion}`)
        .set("Cookie", e.cookieReceptor);

      expect(delEmisor.body.estado).toBe("enviada");
      expect(estadoTrasEmisor.rows[0]?.estado).toBe("enviada");
      expect(delReceptor.body.estado).toBe("abierta");
      expect(delReceptor.body.fechaApertura).not.toBeNull();
    });

    it("un tercero recibe 404", async () => {
      const e = await escenario();
      await crearUsuarioConContrasena(pool, "ajena_reco", "ajena.reco@cinematch.test", CONTRASENA);
      const cookie = cookieDe(
        await request(e.a)
          .post("/api/auth/login")
          .set("Origin", ORIGEN)
          .send({ correo: "ajena.reco@cinematch.test", contrasena: CONTRASENA }),
      );

      const res = await request(e.a)
        .get(`/api/recommendations/${e.recomendacion}`)
        .set("Cookie", cookie);

      expect(res.status).toBe(404);
    });

    it("la reseña adjunta solo se muestra si es visible para el receptor; si no, queda el motivo", async () => {
      const e = await escenario();
      await pool.query("UPDATE recomendacion SET motivo = 'Te va a gustar' WHERE id = $1", [
        e.recomendacion,
      ]);
      const publica = await crearResena(pool, e.emisor, e.titulo, 4);
      await pool.query(
        "UPDATE resena SET comentario = 'Muy buena', es_spoiler = true WHERE id = $1",
        [publica],
      );
      await pool.query("UPDATE recomendacion SET resena_id = $1 WHERE id = $2", [
        publica,
        e.recomendacion,
      ]);

      const visible = await request(e.a)
        .get(`/api/recommendations/${e.recomendacion}`)
        .set("Cookie", e.cookieReceptor);

      await pool.query("UPDATE resena SET visible = false WHERE id = $1", [publica]);
      const oculta = await request(e.a)
        .get(`/api/recommendations/${e.recomendacion}`)
        .set("Cookie", e.cookieReceptor);

      expect(visible.body.resenaAdjunta).toMatchObject({
        calificacion: 4,
        comentario: "Muy buena",
        esSpoiler: true,
      });
      expect(oculta.body.resenaAdjunta).toBeNull();
      expect(oculta.body.motivo).toBe("Te va a gustar");
    });
  });

  describe("aceptar y descartar (BE-10.5)", () => {
    it("aceptar pasa a aceptada, deja el título en pendiente en la biblioteca y avisa al emisor una sola vez", async () => {
      const e = await escenario();

      const primera = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);
      const segunda = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);
      const biblioteca = await pool.query(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [e.receptor, e.titulo],
      );
      const notificaciones = await pool.query(
        "SELECT tipo FROM notificacion WHERE usuario_destinatario_id = $1",
        [e.emisor],
      );

      expect(primera.body).toEqual({ id: e.recomendacion, estado: "aceptada" });
      expect(segunda.status).toBe(200);
      expect(biblioteca.rows[0]?.estado).toBe("pendiente");
      expect(notificaciones.rows.map((f) => f.tipo)).toEqual(["recomendacion_aceptada"]);
    });

    it("aceptar no degrada un título que el receptor ya había visto", async () => {
      const e = await escenario();
      await pool.query(
        "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
        [e.receptor, e.titulo],
      );

      await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);

      const biblioteca = await pool.query(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [e.receptor, e.titulo],
      );
      expect(biblioteca.rows[0]?.estado).toBe("vista");
    });

    it("descartar no notifica al emisor ni toca la biblioteca", async () => {
      const e = await escenario();

      const res = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/discard`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);
      const notificaciones = await pool.query(
        "SELECT count(*) AS total FROM notificacion WHERE usuario_destinatario_id = $1",
        [e.emisor],
      );
      const biblioteca = await pool.query("SELECT 1 FROM seguimiento WHERE usuario_id = $1", [
        e.receptor,
      ]);

      expect(res.body).toEqual({ id: e.recomendacion, estado: "descartada" });
      expect(Number(notificaciones.rows[0]?.total)).toBe(0);
      expect(biblioteca.rows).toHaveLength(0);
    });

    it("una descartada no se puede aceptar después (409)", async () => {
      const e = await escenario();
      await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/discard`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);

      const res = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieReceptor);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    });

    it("solo el receptor puede responder: el emisor recibe 403", async () => {
      const e = await escenario();

      const aceptar = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieEmisor);
      const descartar = await request(e.a)
        .post(`/api/recommendations/${e.recomendacion}/discard`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookieEmisor);

      expect(aceptar.status).toBe(403);
      expect(descartar.status).toBe(403);
    });
  });

  it("el detalle del emisor no muestra reseña del receptor mientras no esté completada", async () => {
    const e = await escenario();

    const res = await request(e.a)
      .get(`/api/recommendations/${e.recomendacion}`)
      .set("Cookie", e.cookieEmisor);

    expect(res.body.resenaReceptor).toBeNull();
  });
});
