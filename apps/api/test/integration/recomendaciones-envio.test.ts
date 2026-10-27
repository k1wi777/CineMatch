import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearGenero,
  crearResena,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";
import { EventBus } from "../../src/lib/events.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("recomendaciones dirigidas: lista de amigos y envío (BE-10.2 y BE-10.3)", () => {
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

  async function usuario(nombre: string): Promise<number> {
    return crearUsuarioConContrasena(pool, nombre, `${nombre}@cinematch.test`, CONTRASENA);
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>, nombre: string): Promise<string> {
    return cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo: `${nombre}@cinematch.test`, contrasena: CONTRASENA }),
    );
  }

  async function interes(usuarioId: number, generoId: number) {
    await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
      usuarioId,
      generoId,
    ]);
  }

  async function amigos(a: number, b: number) {
    await crearAmistad(pool, a, b);
    await pool.query(
      "UPDATE amistad SET estado = 'aceptada' WHERE solicitante_id = $1 AND receptor_id = $2",
      [a, b],
    );
  }

  // Escenario: yo (Ana), con amigos Bruno (género en común), Carla (sin género en común) y Diego (ya vio el título).
  async function escenario() {
    const drama = await crearGenero(pool, "Drama");
    const terror = await crearGenero(pool, "Terror");
    const titulo = await crearContenido(pool, "pelicula", "reco-1");
    await pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, $2)", [
      titulo,
      drama,
    ]);
    const yo = await usuario("reco_yo");
    const bruno = await usuario("reco_bruno");
    const carla = await usuario("reco_carla");
    const diego = await usuario("reco_diego");
    await interes(bruno, drama);
    await interes(carla, terror);
    await interes(diego, drama);
    await pool.query(
      "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
      [diego, titulo],
    );
    await amigos(yo, bruno);
    await amigos(yo, carla);
    await amigos(yo, diego);
    const a = buildTestApp(pool);
    return {
      a,
      yo,
      bruno,
      carla,
      diego,
      titulo,
      drama,
      terror,
      cookie: await sesionDe(a, "reco_yo"),
    };
  }

  it("exige sesión", async () => {
    const a = buildTestApp(pool);

    const lista = await request(a).get("/api/titles/1/recommend/friends");
    const envio = await request(a)
      .post("/api/recommendations")
      .set("Origin", ORIGEN)
      .send({ contentId: 1, amigoId: 2 });

    expect(lista.status).toBe(401);
    expect(envio.status).toBe(401);
  });

  describe("lista de amigos (BE-10.2)", () => {
    it("primero los amigos con géneros en común; después el resto; marca a quien ya lo vio", async () => {
      const e = await escenario();

      const res = await request(e.a)
        .get(`/api/titles/${e.titulo}/recommend/friends`)
        .set("Cookie", e.cookie);

      expect(res.body.map((i: { username: string }) => i.username)).toEqual([
        "reco_bruno",
        "reco_diego",
        "reco_carla",
      ]);
      expect(res.body[0]).toMatchObject({
        generosEnComun: 1,
        fueraDeIntereses: false,
        seleccionable: true,
      });
      expect(res.body[1]).toMatchObject({ yaLaVio: true, seleccionable: false });
      expect(res.body[2]).toMatchObject({
        generosEnComun: 0,
        fueraDeIntereses: true,
        seleccionable: true,
      });
    });

    it("marca a los amigos a los que ya se recomendó el título", async () => {
      const e = await escenario();
      await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.bruno });

      const res = await request(e.a)
        .get(`/api/titles/${e.titulo}/recommend/friends`)
        .set("Cookie", e.cookie);

      const bruno = res.body.find((i: { id: number }) => i.id === e.bruno);
      expect(bruno).toMatchObject({ yaRecomendada: true, seleccionable: false });
    });
  });

  describe("enviar (BE-10.3)", () => {
    it("crea la recomendación en estado enviada, sin reseña previa, y notifica al receptor", async () => {
      const e = await escenario();

      const res = await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.bruno, motivo: "Te va a encantar" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        estado: "enviada",
        emisorId: e.yo,
        receptorId: e.bruno,
        fueraDeIntereses: false,
      });
      const notificaciones = await pool.query(
        "SELECT tipo FROM notificacion WHERE usuario_destinatario_id = $1",
        [e.bruno],
      );
      expect(notificaciones.rows.map((f) => f.tipo)).toEqual(["recomendacion_recibida"]);
    });

    it("marca como fuera de intereses cuando el título no encaja con los del receptor", async () => {
      const e = await escenario();

      const res = await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.carla });

      expect(res.body.fueraDeIntereses).toBe(true);
    });

    it("emite recommendation.sent dentro de la transacción", async () => {
      const eventos = new EventBus({ error: () => undefined });
      const emitidos: unknown[] = [];
      eventos.onInTransaction("recommendation.sent", async (payload) => {
        emitidos.push(payload);
      });
      const e = await escenario();
      const a = buildTestApp(pool, undefined, false, { eventos });

      await request(a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, "reco_yo"))
        .send({ contentId: e.titulo, amigoId: e.bruno });

      expect(emitidos).toHaveLength(1);
      expect(emitidos[0]).toMatchObject({
        senderId: e.yo,
        receiverId: e.bruno,
        contentId: e.titulo,
      });
    });

    it("adjunta una reseña propia, visible y del mismo título", async () => {
      const e = await escenario();
      const resena = await crearResena(pool, e.yo, e.titulo, 4);

      const res = await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.bruno, resenaId: resena });

      expect(res.status).toBe(201);
      expect(res.body.resenaId).toBe(resena);
    });

    it("el motivo se limpia de HTML y tiene un máximo de 500 caracteres", async () => {
      const e = await escenario();

      const limpio = await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.bruno, motivo: "<b>Mira</b>   esta" });
      const largo = await request(e.a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ contentId: e.titulo, amigoId: e.carla, motivo: "x".repeat(501) });

      expect(limpio.body.motivo).toBe("Mira esta");
      expect(largo.status).toBe(422);
      expect(largo.body.error.fields).toHaveProperty("motivo");
    });

    it("rechaza: a uno mismo, a un no amigo, a quien ya vio el título, y repetirla", async () => {
      const e = await escenario();
      const extrano = await usuario("reco_extrano");
      const enviar = (amigoId: number) =>
        request(e.a)
          .post("/api/recommendations")
          .set("Origin", ORIGEN)
          .set("Cookie", e.cookie)
          .send({ contentId: e.titulo, amigoId });

      expect((await enviar(e.yo)).status).toBe(422);
      expect((await enviar(extrano)).status).toBe(403);
      expect((await enviar(e.diego)).status).toBe(409);
      expect((await enviar(e.bruno)).status).toBe(201);
      expect((await enviar(e.bruno)).status).toBe(409);
    });

    it("rechaza una reseña ajena, de otro título o oculta", async () => {
      const e = await escenario();
      const otroTitulo = await crearContenido(pool, "pelicula", "reco-2");
      const ajena = await crearResena(pool, e.bruno, e.titulo, 3);
      const deOtroTitulo = await crearResena(pool, e.yo, otroTitulo, 3);
      const oculta = await crearResena(pool, e.yo, e.titulo, 2);
      await pool.query("UPDATE resena SET visible = false WHERE id = $1", [oculta]);
      const enviar = (resenaId: number) =>
        request(e.a)
          .post("/api/recommendations")
          .set("Origin", ORIGEN)
          .set("Cookie", e.cookie)
          .send({ contentId: e.titulo, amigoId: e.carla, resenaId });

      for (const id of [ajena, deOtroTitulo, oculta]) {
        const res = await enviar(id);
        expect(res.status, `reseña ${id}`).toBe(422);
        expect(res.body.error.fields).toHaveProperty("resenaId");
      }
    });

    it("dos envíos simultáneos iguales dejan una sola recomendación y el segundo recibe 409", async () => {
      const e = await escenario();
      const enviar = () =>
        request(e.a)
          .post("/api/recommendations")
          .set("Origin", ORIGEN)
          .set("Cookie", e.cookie)
          .send({ contentId: e.titulo, amigoId: e.carla });

      const [primera, segunda] = await Promise.all([enviar(), enviar()]);

      expect([primera.status, segunda.status].sort()).toEqual([201, 409]);
      const { rows } = await pool.query("SELECT count(*) AS total FROM recomendacion");
      expect(Number(rows[0]?.total)).toBe(1);
    });
  });
});
