import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearGenero,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

// Ciclo completo de una recomendación dirigida, de extremo a extremo, por HTTP.
describe("flujo completo de recomendaciones dirigidas y privacidad (BE-10.8)", () => {
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

  async function escenario() {
    const drama = await crearGenero(pool, "Drama");
    const titulo = await crearContenido(pool, "pelicula", "flujo-1");
    await pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, $2)", [
      titulo,
      drama,
    ]);
    const emisor = await crearUsuarioConContrasena(
      pool,
      "flujo_emisor",
      "flujo.emisor@cinematch.test",
      CONTRASENA,
    );
    const receptor = await crearUsuarioConContrasena(
      pool,
      "flujo_receptor",
      "flujo.receptor@cinematch.test",
      CONTRASENA,
    );
    const tercero = await crearUsuarioConContrasena(
      pool,
      "flujo_tercero",
      "flujo.tercero@cinematch.test",
      CONTRASENA,
    );
    await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
      receptor,
      drama,
    ]);
    await crearAmistad(pool, emisor, receptor);
    await pool.query("UPDATE amistad SET estado = 'aceptada'");
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
      tercero,
      cookieEmisor: await sesion("flujo.emisor@cinematch.test"),
      cookieReceptor: await sesion("flujo.receptor@cinematch.test"),
      cookieTercero: await sesion("flujo.tercero@cinematch.test"),
    };
  }

  async function enviar(e: Awaited<ReturnType<typeof escenario>>): Promise<number> {
    const res = await request(e.a)
      .post("/api/recommendations")
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieEmisor)
      .send({ contentId: e.titulo, amigoId: e.receptor, motivo: "Te va a gustar" });
    expect(res.status).toBe(201);
    return res.body.id as number;
  }

  it("ciclo completo: enviar, abrir, aceptar, calificar; el emisor ve completada y la calificación del receptor", async () => {
    const e = await escenario();
    expect(
      (
        await request(e.a)
          .get(`/api/titles/${e.titulo}/recommend/friends`)
          .set("Cookie", e.cookieEmisor)
      ).body[0],
    ).toMatchObject({ id: e.receptor, seleccionable: true });
    const id = await enviar(e);

    const recibidas = await request(e.a)
      .get("/api/recommendations/received")
      .set("Cookie", e.cookieReceptor);
    const abierta = await request(e.a)
      .get(`/api/recommendations/${id}`)
      .set("Cookie", e.cookieReceptor);
    const aceptada = await request(e.a)
      .post(`/api/recommendations/${id}/accept`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieReceptor);
    const calificada = await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieReceptor)
      .send({ calificacion: 4.5, comentario: "Muy buena" });
    const enviadaDetalle = await request(e.a)
      .get(`/api/recommendations/${id}`)
      .set("Cookie", e.cookieEmisor);
    const notificaciones = await pool.query(
      "SELECT tipo FROM notificacion WHERE usuario_destinatario_id = $1 ORDER BY id",
      [e.emisor],
    );

    expect(recibidas.body.total).toBe(1);
    expect(abierta.body.estado).toBe("abierta");
    expect(aceptada.body.estado).toBe("aceptada");
    expect(calificada.status).toBe(201);
    expect(enviadaDetalle.body).toMatchObject({
      estado: "completada",
      resenaReceptor: { calificacion: 4.5, comentario: "Muy buena" },
    });
    expect(notificaciones.rows.map((f) => f.tipo)).toEqual([
      "recomendacion_aceptada",
      "recomendacion_completada",
    ]);
  });

  it("ciclo de descarte: descartar no notifica y calificar después no la completa", async () => {
    const e = await escenario();
    const id = await enviar(e);

    const descartada = await request(e.a)
      .post(`/api/recommendations/${id}/discard`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieReceptor);
    await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieReceptor)
      .send({ calificacion: 3 });
    const detalle = await request(e.a)
      .get(`/api/recommendations/${id}`)
      .set("Cookie", e.cookieEmisor);
    const notificaciones = await pool.query(
      "SELECT count(*) AS total FROM notificacion WHERE usuario_destinatario_id = $1",
      [e.emisor],
    );

    expect(descartada.body.estado).toBe("descartada");
    expect(detalle.body.estado).toBe("descartada");
    expect(Number(notificaciones.rows[0]?.total)).toBe(0);
  });

  it("privacidad: un tercero recibe 404 en el detalle, al aceptar y al descartar, y no cambia nada", async () => {
    const e = await escenario();
    const id = await enviar(e);

    const detalle = await request(e.a)
      .get(`/api/recommendations/${id}`)
      .set("Cookie", e.cookieTercero);
    const aceptar = await request(e.a)
      .post(`/api/recommendations/${id}/accept`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieTercero);
    const descartar = await request(e.a)
      .post(`/api/recommendations/${id}/discard`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieTercero);
    const estado = await pool.query("SELECT estado FROM recomendacion WHERE id = $1", [id]);

    expect(detalle.status).toBe(404);
    expect(aceptar.status).toBe(404);
    expect(descartar.status).toBe(404);
    expect(estado.rows[0]?.estado).toBe("enviada");
  });

  it("privacidad: el emisor no puede abrir ni responder la recomendación que envió", async () => {
    const e = await escenario();
    const id = await enviar(e);

    const aceptar = await request(e.a)
      .post(`/api/recommendations/${id}/accept`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookieEmisor);
    const estado = await pool.query("SELECT estado FROM recomendacion WHERE id = $1", [id]);

    expect(aceptar.status).toBe(403);
    expect(estado.rows[0]?.estado).toBe("enviada");
  });
});
