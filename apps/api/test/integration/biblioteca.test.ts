import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearGenero, crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("biblioteca personal (BE-8.1 y BE-8.2)", () => {
  let pool: pg.Pool;
  let accion: number;
  let drama: number;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    accion = await crearGenero(pool, "Acción");
    drama = await crearGenero(pool, "Drama");
    await crearUsuarioConContrasena(pool, "biblio_usuario", "biblio@cinematch.test", CONTRASENA);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function titulo(datos: {
    titulo: string;
    tipo?: "pelicula" | "serie";
    anio?: number;
    generos?: number[];
  }): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO contenido (tipo, titulo, anio, fuente, id_externo, fecha_actualizacion)
       VALUES ($1::tipo_contenido, $2, $3, 'prueba', $4, now()) RETURNING id`,
      [
        datos.tipo ?? "pelicula",
        datos.titulo,
        datos.anio ?? 2000,
        `${datos.titulo}-${Math.random()}`,
      ],
    );
    const id = rows[0]?.id ?? 0;
    for (const genero of datos.generos ?? []) {
      await pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, $2)", [
        id,
        genero,
      ]);
    }
    return id;
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>): Promise<string> {
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: "biblio@cinematch.test", contrasena: CONTRASENA });
    return cookieDe(res);
  }

  async function poner(
    a: ReturnType<typeof buildTestApp>,
    cookie: string,
    contenido: number,
    estado: string,
  ) {
    return request(a)
      .put(`/api/library/${contenido}`)
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ estado });
  }

  it("exige sesión para leer y escribir", async () => {
    const a = buildTestApp(pool);
    const contenido = await titulo({ titulo: "Sin sesión" });

    expect((await request(a).get("/api/library")).status).toBe(401);
    expect(
      (
        await request(a)
          .put(`/api/library/${contenido}`)
          .set("Origin", ORIGEN)
          .send({ estado: "vista" })
      ).status,
    ).toBe(401);
  });

  describe("escribir el estado (BE-8.1)", () => {
    it("crea y cambia el estado con los cuatro valores", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await titulo({ titulo: "Cuatro estados" });

      for (const estado of ["pendiente", "viendo", "vista", "abandonada"]) {
        const res = await poner(a, cookie, contenido, estado);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ contenidoId: contenido, estado });
      }
      const { rows } = await pool.query(
        "SELECT count(*) AS total FROM seguimiento WHERE contenido_id = $1",
        [contenido],
      );
      expect(Number(rows[0]?.total)).toBe(1);
    });

    it("un estado inválido se rechaza con 422", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await titulo({ titulo: "Estado malo" });

      const res = await poner(a, cookie, contenido, "favorita");

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("estado");
    });

    it("un título inexistente devuelve 404", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);

      const res = await poner(a, cookie, 999_999, "vista");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("cambiar el estado actualiza la fecha", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await titulo({ titulo: "Fecha" });
      await poner(a, cookie, contenido, "pendiente");
      await pool.query("UPDATE seguimiento SET fecha_actualizacion = '2000-01-01T00:00:00Z'");

      const res = await poner(a, cookie, contenido, "viendo");

      expect(new Date(res.body.fechaActualizacion).getFullYear()).toBeGreaterThan(2000);
    });

    it("quitar es idempotente y el título desaparece de la biblioteca", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await titulo({ titulo: "Quitar" });
      await poner(a, cookie, contenido, "vista");

      const primero = await request(a)
        .delete(`/api/library/${contenido}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);
      const segundo = await request(a)
        .delete(`/api/library/${contenido}`)
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);
      const lista = await request(a).get("/api/library").set("Cookie", cookie);

      expect(primero.status).toBe(204);
      expect(segundo.status).toBe(204);
      expect(lista.body.total).toBe(0);
    });
  });

  describe("consultar la biblioteca (BE-8.2)", () => {
    it("filtra por estado, tipo y géneros", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const peli = await titulo({ titulo: "Peli acción", generos: [accion] });
      const serie = await titulo({ titulo: "Serie drama", tipo: "serie", generos: [drama] });
      const otra = await titulo({ titulo: "Peli drama", generos: [drama] });
      await poner(a, cookie, peli, "vista");
      await poner(a, cookie, serie, "vista");
      await poner(a, cookie, otra, "viendo");

      const porEstado = await request(a).get("/api/library?estado=vista").set("Cookie", cookie);
      const porTipo = await request(a).get("/api/library?tipo=serie").set("Cookie", cookie);
      const porGenero = await request(a)
        .get(`/api/library?generoIds=${accion}`)
        .set("Cookie", cookie);

      expect(porEstado.body.items.map((i: { id: number }) => i.id).sort()).toEqual(
        [peli, serie].sort(),
      );
      expect(porTipo.body.items.map((i: { id: number }) => i.id)).toEqual([serie]);
      expect(porGenero.body.items.map((i: { id: number }) => i.id)).toEqual([peli]);
    });

    it("ordena por título y por fecha, en ambas direcciones", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const b = await titulo({ titulo: "Bravo" });
      const alfa = await titulo({ titulo: "alfa" });
      await poner(a, cookie, b, "vista");
      await poner(a, cookie, alfa, "vista");

      const titulosAsc = await request(a)
        .get("/api/library?orden=titulo&dir=asc")
        .set("Cookie", cookie);
      const titulosDesc = await request(a)
        .get("/api/library?orden=titulo&dir=desc")
        .set("Cookie", cookie);
      const fechaAsc = await request(a)
        .get("/api/library?orden=fecha&dir=asc")
        .set("Cookie", cookie);

      expect(titulosAsc.body.items.map((i: { titulo: string }) => i.titulo)).toEqual([
        "alfa",
        "Bravo",
      ]);
      expect(titulosDesc.body.items.map((i: { titulo: string }) => i.titulo)).toEqual([
        "Bravo",
        "alfa",
      ]);
      expect(fechaAsc.body.items[0].id).toBe(b);
    });

    it("los conteos por estado son correctos y respetan tipo y géneros, no el filtro de estado", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const uno = await titulo({ titulo: "Conteo uno", generos: [accion] });
      const dos = await titulo({ titulo: "Conteo dos", generos: [drama] });
      const tres = await titulo({ titulo: "Conteo tres", tipo: "serie", generos: [accion] });
      await poner(a, cookie, uno, "vista");
      await poner(a, cookie, dos, "vista");
      await poner(a, cookie, tres, "viendo");

      const sinFiltro = await request(a).get("/api/library").set("Cookie", cookie);
      const conFiltro = await request(a).get("/api/library?estado=vista").set("Cookie", cookie);
      const conGenero = await request(a)
        .get(`/api/library?generoIds=${accion}`)
        .set("Cookie", cookie);

      expect(sinFiltro.body.conteos).toEqual({
        pendiente: 0,
        viendo: 1,
        vista: 2,
        abandonada: 0,
        total: 3,
      });
      expect(conFiltro.body.conteos.total).toBe(3);
      expect(conGenero.body.conteos).toEqual({
        pendiente: 0,
        viendo: 1,
        vista: 1,
        abandonada: 0,
        total: 2,
      });
    });

    it("la lista trae póster, título, año, tipo, estado y géneros", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      const contenido = await titulo({ titulo: "Completa", anio: 1994, generos: [drama] });
      await poner(a, cookie, contenido, "abandonada");

      const res = await request(a).get("/api/library").set("Cookie", cookie);

      expect(res.body.items[0]).toMatchObject({
        id: contenido,
        tipo: "pelicula",
        titulo: "Completa",
        anio: 1994,
        estado: "abandonada",
        generos: [{ id: drama, nombre: "Drama" }],
      });
    });

    it("la biblioteca está paginada y solo muestra la del usuario de la sesión", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);
      for (let i = 1; i <= 3; i++) {
        await poner(a, cookie, await titulo({ titulo: `Paginada ${i}` }), "pendiente");
      }
      const otro = await crearUsuarioConContrasena(
        pool,
        "biblio_otro",
        "otro.biblio@cinematch.test",
        CONTRASENA,
      );
      await pool.query(
        "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
        [otro, await titulo({ titulo: "Ajena" })],
      );

      const pagina = await request(a).get("/api/library?pageSize=2&page=2").set("Cookie", cookie);

      expect(pagina.body.items).toHaveLength(1);
      expect(pagina.body.total).toBe(3);
      expect(pagina.body.items.every((i: { titulo: string }) => i.titulo !== "Ajena")).toBe(true);
    });

    it("valida los parámetros con 422", async () => {
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a);

      const orden = await request(a).get("/api/library?orden=puntuacion").set("Cookie", cookie);
      const estado = await request(a).get("/api/library?estado=cualquiera").set("Cookie", cookie);

      expect(orden.status).toBe(422);
      expect(estado.status).toBe(422);
    });
  });
});
