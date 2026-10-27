import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearGenero, crearUsuarioConContrasena } from "../helpers/fixtures.js";

const CORREO = "catalogo@cinematch.test";
const CONTRASENA = "Clave1234";
const ORIGEN = "http://localhost:3000";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("catálogo: listado, búsqueda y ficha (BE-6.4 y BE-6.5)", () => {
  let pool: pg.Pool;
  let accion: number;
  let drama: number;
  let comedia: number;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    accion = await crearGenero(pool, "Acción");
    drama = await crearGenero(pool, "Drama");
    comedia = await crearGenero(pool, "Comedia");
    await crearUsuarioConContrasena(pool, "catalogo_usuario", CORREO, CONTRASENA);
  });

  afterAll(async () => {
    await pool.end();
  });

  // Inserta un título con géneros. Los ids de las fuentes son únicos por fila.
  async function titulo(datos: {
    tipo?: "pelicula" | "serie";
    titulo: string;
    anio?: number;
    popularidad?: number | null;
    generos?: number[];
    sinopsis?: string;
    director?: string;
    duracion?: number;
  }): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO contenido (tipo, titulo, anio, popularidad_externa, fuente, id_externo,
                              fecha_actualizacion, sinopsis, director, duracion, poster_url)
       VALUES ($1::tipo_contenido, $2, $3, $4, 'prueba', $5, now(), $6, $7, $8, '/p.jpg')
       RETURNING id`,
      [
        datos.tipo ?? "pelicula",
        datos.titulo,
        datos.anio ?? 2020,
        datos.popularidad ?? null,
        `${datos.titulo}-${Math.random()}`,
        datos.sinopsis ?? null,
        datos.director ?? null,
        datos.duracion ?? null,
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

  async function sesionDe(app: ReturnType<typeof buildTestApp>): Promise<string> {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO, contrasena: CONTRASENA });
    return cookieDe(res);
  }

  it("exige sesión (401 sin cookie)", async () => {
    const app = buildTestApp(pool);

    expect((await request(app).get("/api/catalog")).status).toBe(401);
    expect((await request(app).get("/api/catalog/1")).status).toBe(401);
  });

  it("busca sin distinguir mayúsculas ni tildes", async () => {
    await titulo({ titulo: "Año cero" });
    await titulo({ titulo: "Ánimas" });
    await titulo({ titulo: "Otra cosa" });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const sinTilde = await request(app).get("/api/catalog?q=ANO").set("Cookie", sesion);
    const conTilde = await request(app).get("/api/catalog?q=animas").set("Cookie", sesion);
    const eñe = await request(app).get("/api/catalog?q=AÑO").set("Cookie", sesion);

    expect(sinTilde.body.items.map((i: { titulo: string }) => i.titulo)).toEqual(["Año cero"]);
    expect(conTilde.body.items.map((i: { titulo: string }) => i.titulo)).toEqual(["Ánimas"]);
    expect(eñe.body.items.map((i: { titulo: string }) => i.titulo)).toEqual(["Año cero"]);
  });

  it("trata % y _ de la búsqueda como texto literal", async () => {
    await titulo({ titulo: "100% prueba" });
    await titulo({ titulo: "100 prueba" });
    await titulo({ titulo: "Otro_título" });
    await titulo({ titulo: "Otro-título" });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const porcentaje = await request(app).get("/api/catalog?q=100%25").set("Cookie", sesion);
    const guion = await request(app).get("/api/catalog?q=otro_titulo").set("Cookie", sesion);

    expect(porcentaje.body.items.map((i: { titulo: string }) => i.titulo)).toEqual(["100% prueba"]);
    expect(guion.body.items.map((i: { titulo: string }) => i.titulo)).toEqual(["Otro_título"]);
  });

  it("filtra por tipo", async () => {
    await titulo({ titulo: "Película uno", tipo: "pelicula" });
    await titulo({ titulo: "Serie uno", tipo: "serie" });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const res = await request(app).get("/api/catalog?tipo=serie").set("Cookie", sesion);

    expect(res.body.items.map((i: { tipo: string }) => i.tipo)).toEqual(["serie"]);
  });

  it("filtra por géneros: basta con que coincida uno de los indicados", async () => {
    const soloAccion = await titulo({ titulo: "Solo acción", generos: [accion] });
    const soloDrama = await titulo({ titulo: "Solo drama", generos: [drama] });
    await titulo({ titulo: "Solo comedia", generos: [comedia] });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const res = await request(app)
      .get(`/api/catalog?generoIds=${accion},${drama}`)
      .set("Cookie", sesion);

    const ids = res.body.items
      .map((i: { id: number }) => i.id)
      .sort((a: number, b: number) => a - b);
    expect(ids).toEqual([soloAccion, soloDrama].sort((a, b) => a - b));
    expect(res.body.total).toBe(2);
  });

  it("ordena por popularidad externa descendente, con los sin dato al final", async () => {
    const baja = await titulo({ titulo: "Baja", popularidad: 10 });
    const sinDato = await titulo({ titulo: "Sin dato", popularidad: null });
    const alta = await titulo({ titulo: "Alta", popularidad: 99 });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const res = await request(app).get("/api/catalog").set("Cookie", sesion);

    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([alta, baja, sinDato]);
  });

  it("pagina sin repetir ni saltar títulos y devuelve el total", async () => {
    for (let i = 1; i <= 5; i++) {
      await titulo({ titulo: `Título ${i}`, popularidad: 100 - i });
    }
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const paginas = [1, 2, 3].map((page) =>
      request(app).get(`/api/catalog?pageSize=2&page=${page}`).set("Cookie", sesion),
    );
    const [p1, p2, p3] = await Promise.all(paginas);
    const ids = [...p1!.body.items, ...p2!.body.items, ...p3!.body.items].map(
      (i: { id: number }) => i.id,
    );

    expect(p3!.body.items).toHaveLength(1);
    expect(new Set(ids).size).toBe(5);
    expect(p1!.body.total).toBe(5);
  });

  it("cada elemento trae póster, título, año, tipo y géneros con su id", async () => {
    await titulo({ titulo: "Completa", anio: 1999, generos: [drama, accion] });
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const res = await request(app).get("/api/catalog").set("Cookie", sesion);

    expect(res.body.items[0]).toMatchObject({
      tipo: "pelicula",
      titulo: "Completa",
      anio: 1999,
      posterUrl: "/p.jpg",
      generos: [
        { id: accion, nombre: "Acción" },
        { id: drama, nombre: "Drama" },
      ],
    });
  });

  it("valida los parámetros con 422", async () => {
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const pagina = await request(app).get("/api/catalog?pageSize=51").set("Cookie", sesion);
    const tipo = await request(app).get("/api/catalog?tipo=documental").set("Cookie", sesion);
    const generos = await request(app).get("/api/catalog?generoIds=abc").set("Cookie", sesion);

    expect(pagina.status).toBe(422);
    expect(tipo.status).toBe(422);
    expect(generos.status).toBe(422);
  });

  it("responde en menos de 2 s con un catálogo de 1200 títulos", async () => {
    await pool.query(
      `INSERT INTO contenido (tipo, titulo, anio, popularidad_externa, fuente, id_externo, fecha_actualizacion)
       SELECT 'pelicula'::tipo_contenido, 'Título masivo ' || g, 2000, g % 100, 'carga', g::text, now()
         FROM generate_series(1, 1200) AS g`,
    );
    const app = buildTestApp(pool);
    const sesion = await sesionDe(app);

    const inicio = Date.now();
    const res = await request(app).get("/api/catalog?q=masivo&pageSize=50").set("Cookie", sesion);
    const duracion = Date.now() - inicio;

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1200);
    expect(duracion).toBeLessThan(2000);
  });

  describe("ficha base (BE-6.5)", () => {
    it("devuelve todos los campos de la ficha con sus géneros", async () => {
      const id = await titulo({
        titulo: "Ficha completa",
        sinopsis: "Sinopsis de prueba",
        director: "Directora",
        duracion: 120,
        anio: 2011,
        popularidad: 42.5,
        generos: [drama],
      });
      const app = buildTestApp(pool);
      const sesion = await sesionDe(app);

      const res = await request(app).get(`/api/catalog/${id}`).set("Cookie", sesion);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        tipo: "pelicula",
        titulo: "Ficha completa",
        sinopsis: "Sinopsis de prueba",
        anio: 2011,
        director: "Directora",
        duracion: 120,
        posterUrl: "/p.jpg",
        popularidadExterna: 42.5,
        generos: [{ id: drama, nombre: "Drama" }],
      });
      expect(typeof res.body.fechaActualizacion).toBe("string");
    });

    it("un id inexistente devuelve 404 y uno mal formado 422", async () => {
      const app = buildTestApp(pool);
      const sesion = await sesionDe(app);

      const noExiste = await request(app).get("/api/catalog/999999").set("Cookie", sesion);
      const malFormado = await request(app).get("/api/catalog/abc").set("Cookie", sesion);

      expect(noExiste.status).toBe(404);
      expect(noExiste.body.error.code).toBe("NOT_FOUND");
      expect(malFormado.status).toBe(422);
    });
  });
});
