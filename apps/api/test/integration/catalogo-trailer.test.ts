import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MovieProvider } from "../../src/modules/catalogo/proveedor/movie-provider.js";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";

const CORREO = "trailer@cinematch.test";
const CONTRASENA = "Clave1234";
const ORIGEN = "http://localhost:3000";
const ENLACE = "https://www.youtube.com/watch?v=abc123xyz";

function proveedorConTrailer(fuente: string, enlace: string | null) {
  const llamadas: string[] = [];
  const proveedor: MovieProvider = {
    fuente,
    fetchGenres: async () => [],
    fetchPopular: async () => [],
    fetchDetails: async () => null,
    fetchTrailer: async (_tipo, idExterno) => {
      llamadas.push(idExterno);
      return enlace;
    },
  };
  return { proveedor, llamadas };
}

describe("tráiler de la ficha: enlace guardado y caché", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    await crearUsuarioConContrasena(pool, "trailer_usuario", CORREO, CONTRASENA);
  });

  afterAll(async () => {
    await pool.end();
  });

  // Inserta un título de la fuente indicada. El id externo es único por fila.
  async function titulo(fuente: string): Promise<{ id: number; idExterno: string }> {
    const idExterno = `${fuente}-${Math.random()}`;
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO contenido (tipo, titulo, fuente, id_externo, fecha_actualizacion)
       VALUES ('pelicula', 'Con tráiler', $1, $2, now())
       RETURNING id`,
      [fuente, idExterno],
    );
    return { id: rows[0]?.id ?? 0, idExterno };
  }

  async function sesionDe(app: ReturnType<typeof buildTestApp>): Promise<string> {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO, contrasena: CONTRASENA });
    return String(res.headers["set-cookie"]).split(";")[0] ?? "";
  }

  it("consulta la fuente una sola vez y reutiliza el enlace guardado", async () => {
    const { id } = await titulo("prueba");
    const { proveedor, llamadas } = proveedorConTrailer("prueba", ENLACE);
    const app = buildTestApp(pool, undefined, true, { proveedorCatalogo: proveedor });
    const sesion = await sesionDe(app);

    const primera = await request(app).get(`/api/catalog/${id}/trailer`).set("Cookie", sesion);
    const segunda = await request(app).get(`/api/catalog/${id}/trailer`).set("Cookie", sesion);

    expect(primera.status).toBe(200);
    expect(primera.body).toEqual({ url: ENLACE });
    expect(segunda.body).toEqual({ url: ENLACE });
    expect(llamadas).toHaveLength(1);
  });

  it("guarda null cuando el título no tiene tráiler, y no lo vuelve a pedir", async () => {
    const { id } = await titulo("prueba");
    const { proveedor, llamadas } = proveedorConTrailer("prueba", null);
    const app = buildTestApp(pool, undefined, true, { proveedorCatalogo: proveedor });
    const sesion = await sesionDe(app);

    expect(
      (await request(app).get(`/api/catalog/${id}/trailer`).set("Cookie", sesion)).body,
    ).toEqual({
      url: null,
    });
    await request(app).get(`/api/catalog/${id}/trailer`).set("Cookie", sesion);
    expect(llamadas).toHaveLength(1);
  });

  it("no consulta títulos de otra fuente (p. ej. los de demostración)", async () => {
    const { id } = await titulo("demo");
    const { proveedor, llamadas } = proveedorConTrailer("prueba", ENLACE);
    const app = buildTestApp(pool, undefined, true, { proveedorCatalogo: proveedor });
    const sesion = await sesionDe(app);

    const res = await request(app).get(`/api/catalog/${id}/trailer`).set("Cookie", sesion);

    expect(res.body).toEqual({ url: null });
    expect(llamadas).toHaveLength(0);
  });

  it("responde 404 si el título no existe y 401 sin sesión", async () => {
    const { proveedor } = proveedorConTrailer("prueba", ENLACE);
    const app = buildTestApp(pool, undefined, true, { proveedorCatalogo: proveedor });
    const sesion = await sesionDe(app);

    expect(
      (await request(app).get("/api/catalog/999999/trailer").set("Cookie", sesion)).status,
    ).toBe(404);
    expect((await request(app).get("/api/catalog/1/trailer")).status).toBe(401);
  });
});
