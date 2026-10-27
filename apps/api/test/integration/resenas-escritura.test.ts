import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearContenido,
  crearRecomendacion,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";
import { EventBus } from "../../src/lib/events.js";

const ORIGEN = "http://localhost:3000";
const CORREO = "resena@cinematch.test";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("escribir, editar y eliminar reseñas (BE-9.1, BE-9.2 y BE-9.3)", () => {
  let pool: pg.Pool;
  let usuario: number;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    usuario = await crearUsuarioConContrasena(pool, "resena_autora", CORREO, CONTRASENA);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function sesionDe(a: ReturnType<typeof buildTestApp>): Promise<string> {
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO, contrasena: CONTRASENA });
    return cookieDe(res);
  }

  function escribir(
    a: ReturnType<typeof buildTestApp>,
    cookie: string,
    contenido: number,
    cuerpo: object,
  ) {
    return request(a)
      .put(`/api/titles/${contenido}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send(cuerpo);
  }

  async function etiquetasDe(resena: number): Promise<string[]> {
    const { rows } = await pool.query<{ texto: string }>(
      `SELECT e.texto FROM resena_etiqueta re JOIN etiqueta e ON e.id = re.etiqueta_id
        WHERE re.resena_id = $1 ORDER BY e.texto`,
      [resena],
    );
    return rows.map((fila) => fila.texto);
  }

  it("exige sesión para escribir y para eliminar", async () => {
    const a = buildTestApp(pool);
    const contenido = await crearContenido(pool, "pelicula", "auth-1");

    const escritura = await request(a)
      .put(`/api/titles/${contenido}/review`)
      .set("Origin", ORIGEN)
      .send({ calificacion: 4 });
    const borrado = await request(a).delete("/api/reviews/1").set("Origin", ORIGEN);

    expect(escritura.status).toBe(401);
    expect(borrado.status).toBe(401);
  });

  describe("escribir (BE-9.1)", () => {
    it("crea la reseña con calificación en medio punto, comentario, visibilidad y spoiler", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "crea-1");

      const res = await escribir(a, cookie, contenido, {
        calificacion: 4.5,
        comentario: "Muy buena",
        visibilidad: "amigos",
        esSpoiler: true,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        contenidoId: contenido,
        calificacion: 4.5,
        comentario: "Muy buena",
        visibilidad: "amigos",
        esSpoiler: true,
        etiquetas: [],
        fechaEdicion: null,
      });
    });

    it("una calificación fuera de rango o de paso se rechaza con 422", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "rango-1");

      for (const calificacion of [0, 5.5, 3.3]) {
        const res = await escribir(a, cookie, contenido, { calificacion });
        expect(res.status, `calificación ${calificacion}`).toBe(422);
        expect(res.body.error.fields).toHaveProperty("calificacion");
      }
    });

    it("solo calificación (sin comentario) es válida y se guarda sin etiquetas", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "solo-1");

      const res = await escribir(a, cookie, contenido, { calificacion: 3 });

      expect(res.status).toBe(201);
      expect(res.body.comentario).toBeNull();
    });

    it("una reseña por usuario y título: repetirla actualiza y fija fecha de edición", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "unica-1");
      const primera = await escribir(a, cookie, contenido, { calificacion: 2 });

      const segunda = await escribir(a, cookie, contenido, { calificacion: 5 });

      expect(segunda.status).toBe(200);
      expect(segunda.body.id).toBe(primera.body.id);
      expect(segunda.body.calificacion).toBe(5);
      expect(segunda.body.fechaEdicion).not.toBeNull();
      const { rows } = await pool.query(
        "SELECT count(*) AS total FROM resena WHERE usuario_id = $1",
        [usuario],
      );
      expect(Number(rows[0]?.total)).toBe(1);
    });

    it("sanitiza el comentario: sin etiquetas HTML", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "html-1");

      const res = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "<b>Hola</b>   mundo",
      });

      expect(res.body.comentario).toBe("Hola mundo");
    });

    it("un título inexistente devuelve 404", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);

      const res = await escribir(a, cookie, 999_999, { calificacion: 4 });

      expect(res.status).toBe(404);
    });

    it("calificar marca el título como vista en la biblioteca (RN2)", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "rn2-1");

      await escribir(a, cookie, contenido, { calificacion: 4 });

      const { rows } = await pool.query(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [usuario, contenido],
      );
      expect(rows[0]?.estado).toBe("vista");
    });

    it("emite review.created la primera vez y review.updated al editar, en la misma transacción", async () => {
      const eventos = new EventBus({ error: () => undefined });
      const emitidos: string[] = [];
      eventos.onInTransaction("review.created", async () => {
        emitidos.push("created");
      });
      eventos.onInTransaction("review.updated", async () => {
        emitidos.push("updated");
      });
      const a = buildTestApp(pool, undefined, false, { eventos });
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "evento-1");

      await escribir(a, cookie, contenido, { calificacion: 4 });
      await escribir(a, cookie, contenido, { calificacion: 3 });

      expect(emitidos).toEqual(["created", "updated"]);
    });
  });

  describe("etiquetas (BE-9.2)", () => {
    it("normaliza: minúsculas, sin tildes, espacios colapsados y sin duplicados", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "norm-1");

      const res = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "Algo",
        etiquetas: ["Ciencia Ficción", "ciencia ficcion", "  CIENCIA   ficción "],
      });

      expect(res.body.etiquetas).toEqual(["ciencia ficcion"]);
      expect(await etiquetasDe(res.body.id)).toEqual(["ciencia ficcion"]);
    });

    it("reutiliza las filas de etiqueta existentes", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const otra = await crearUsuarioConContrasena(
        pool,
        "resena_otra",
        "otra@cinematch.test",
        CONTRASENA,
      );
      void otra;
      const contenido1 = await crearContenido(pool, "pelicula", "reu-1");
      const contenido2 = await crearContenido(pool, "pelicula", "reu-2");

      await escribir(a, cookie, contenido1, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["drama"],
      });
      await escribir(a, cookie, contenido2, {
        calificacion: 4,
        comentario: "y",
        etiquetas: ["drama"],
      });

      const { rows } = await pool.query(
        "SELECT count(*) AS total FROM etiqueta WHERE texto = 'drama'",
      );
      expect(Number(rows[0]?.total)).toBe(1);
    });

    it("sin comentario no se admiten etiquetas (422)", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "sincom-1");

      const res = await escribir(a, cookie, contenido, { calificacion: 4, etiquetas: ["drama"] });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("etiquetas");
    });

    it("hasta 5 etiquetas: la sexta se rechaza (422)", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "limite-1");
      const seis = ["uno", "dos", "tres", "cuatro", "cinco", "seis"];

      const quinta = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: seis.slice(0, 5),
      });
      const sexta = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: seis,
      });

      expect(quinta.status).toBe(201);
      expect(sexta.status).toBe(422);
    });

    it("una etiqueta de más de 30 caracteres se rechaza (422)", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "largo-1");

      const res = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["a".repeat(31)],
      });

      expect(res.status).toBe(422);
    });

    it("editar reemplaza el conjunto de etiquetas", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "reemplaza-1");
      await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["uno", "dos"],
      });

      const res = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["tres"],
      });

      expect(res.body.etiquetas).toEqual(["tres"]);
      expect(await etiquetasDe(res.body.id)).toEqual(["tres"]);
    });

    it("quitar el comentario al editar quita también las etiquetas", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "quita-1");
      const creada = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["uno"],
      });

      const res = await escribir(a, cookie, contenido, { calificacion: 4 });

      expect(res.body.etiquetas).toEqual([]);
      expect(await etiquetasDe(creada.body.id)).toEqual([]);
    });
  });

  describe("eliminar (BE-9.3)", () => {
    it("solo el autor puede eliminar; las etiquetas se borran en cascada y la biblioteca no cambia", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "borra-1");
      const creada = await escribir(a, cookie, contenido, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["uno"],
      });

      const ajena = await crearUsuarioConContrasena(
        pool,
        "resena_ajena",
        "ajena@cinematch.test",
        CONTRASENA,
      );
      void ajena;
      const cookieAjena = await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo: "ajena@cinematch.test", contrasena: CONTRASENA })
        .then((res) => cookieDe(res));
      const intento = await request(a)
        .delete(`/api/reviews/${creada.body.id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookieAjena);
      const borrado = await request(a)
        .delete(`/api/reviews/${creada.body.id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);

      expect(intento.status).toBe(404);
      expect(borrado.status).toBe(204);
      expect(await etiquetasDe(creada.body.id)).toEqual([]);
      const biblioteca = await pool.query(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [usuario, contenido],
      );
      expect(biblioteca.rows[0]?.estado).toBe("vista");
    });

    it("las recomendaciones que la adjuntaban conservan su motivo, sin reseña", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "recom-1");
      const creada = await escribir(a, cookie, contenido, { calificacion: 4, comentario: "x" });
      const otro = await crearUsuarioConContrasena(
        pool,
        "resena_receptora",
        "receptora@cinematch.test",
        CONTRASENA,
      );
      const recomendacion = await crearRecomendacion(pool, usuario, otro, contenido);
      await pool.query(
        "UPDATE recomendacion SET resena_id = $1, motivo = 'Te va a gustar' WHERE id = $2",
        [creada.body.id, recomendacion],
      );

      await request(a)
        .delete(`/api/reviews/${creada.body.id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);

      const { rows } = await pool.query(
        "SELECT resena_id, motivo FROM recomendacion WHERE id = $1",
        [recomendacion],
      );
      expect(rows[0]).toEqual({ resena_id: null, motivo: "Te va a gustar" });
    });

    it("emite review.deleted dentro de la transacción", async () => {
      const eventos = new EventBus({ error: () => undefined });
      const emitidos: number[] = [];
      eventos.onInTransaction("review.deleted", async (payload) => {
        emitidos.push(payload.reviewId);
      });
      const a = buildTestApp(pool, undefined, false, { eventos });
      const cookie = await sesionDe(a);
      const contenido = await crearContenido(pool, "pelicula", "evento-borra");
      const creada = await escribir(a, cookie, contenido, { calificacion: 4, comentario: "x" });

      await request(a)
        .delete(`/api/reviews/${creada.body.id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);

      expect(emitidos).toEqual([creada.body.id]);
    });
  });
});
