import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearRecomendacion,
  crearResena,
  crearUsuario,
} from "../helpers/fixtures.js";

async function expectError(promesa: Promise<unknown>, codigo: string): Promise<void> {
  await expect(promesa).rejects.toMatchObject({ code: codigo });
}

describe("integridad de recomendaciones y notificaciones (BE-1.5)", () => {
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

  it("rechaza una recomendación a uno mismo (23514)", async () => {
    const usuario = await crearUsuario(pool, "yo_mismo");
    const contenido = await crearContenido(pool, "pelicula", "1");
    await expectError(crearRecomendacion(pool, usuario, usuario, contenido), "23514");
  });

  it("rechaza una recomendación duplicada del mismo emisor, receptor y título (23505)", async () => {
    const emisor = await crearUsuario(pool, "emisor");
    const receptor = await crearUsuario(pool, "receptor");
    const contenido = await crearContenido(pool, "pelicula", "1");
    await crearRecomendacion(pool, emisor, receptor, contenido);
    await expectError(crearRecomendacion(pool, emisor, receptor, contenido), "23505");
  });

  it("rechaza un estado de recomendación fuera del enum (22P02)", async () => {
    const emisor = await crearUsuario(pool, "emisor_estado");
    const receptor = await crearUsuario(pool, "receptor_estado");
    const contenido = await crearContenido(pool, "pelicula", "1");
    await expectError(
      pool.query(
        "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, estado, fecha_envio) VALUES ($1, $2, $3, 'leida', now())",
        [emisor, receptor, contenido],
      ),
      "22P02",
    );
  });

  it("conserva la recomendación y anula la reseña adjunta al borrarla", async () => {
    const emisor = await crearUsuario(pool, "adjunta_emisor");
    const receptor = await crearUsuario(pool, "adjunta_receptor");
    const contenido = await crearContenido(pool, "pelicula", "1");
    const resena = await crearResena(pool, emisor, contenido, 4);
    const recomendacion = await pool.query<{ id: number }>(
      "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, resena_id, motivo, fecha_envio) VALUES ($1, $2, $3, $4, 'Te va a gustar', now()) RETURNING id",
      [emisor, receptor, contenido, resena],
    );

    await pool.query("DELETE FROM resena WHERE id = $1", [resena]);

    const { rows } = await pool.query<{ resena_id: number | null; motivo: string }>(
      "SELECT resena_id, motivo FROM recomendacion WHERE id = $1",
      [recomendacion.rows[0]?.id],
    );
    expect(rows[0]?.resena_id).toBeNull();
    expect(rows[0]?.motivo).toBe("Te va a gustar");
  });

  it("rechaza una notificación sin origen (23514)", async () => {
    const usuario = await crearUsuario(pool, "sin_origen");
    await expectError(
      pool.query(
        "INSERT INTO notificacion (usuario_destinatario_id, tipo) VALUES ($1, 'solicitud_amistad')",
        [usuario],
      ),
      "23514",
    );
  });

  it("rechaza una notificación con dos orígenes (23514)", async () => {
    const ana = await crearUsuario(pool, "dos_origenes_ana");
    const luis = await crearUsuario(pool, "dos_origenes_luis");
    const contenido = await crearContenido(pool, "pelicula", "1");
    const amistad = await crearAmistad(pool, ana, luis);
    const resena = await crearResena(pool, luis, contenido, 4);
    await expectError(
      pool.query(
        "INSERT INTO notificacion (usuario_destinatario_id, tipo, amistad_id, resena_id) VALUES ($1, 'solicitud_amistad', $2, $3)",
        [ana, amistad, resena],
      ),
      "23514",
    );
  });

  it("acepta una notificación con exactamente un origen", async () => {
    const ana = await crearUsuario(pool, "un_origen_ana");
    const luis = await crearUsuario(pool, "un_origen_luis");
    const amistad = await crearAmistad(pool, luis, ana);
    await pool.query(
      "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, amistad_id) VALUES ($1, $2, 'solicitud_amistad', $3)",
      [ana, luis, amistad],
    );

    const { rows } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM notificacion",
    );
    expect(rows[0]?.total).toBe("1");
  });

  it("elimina la notificación al borrarse la recomendación que la origina", async () => {
    const emisor = await crearUsuario(pool, "origen_emisor");
    const receptor = await crearUsuario(pool, "origen_receptor");
    const contenido = await crearContenido(pool, "pelicula", "1");
    const recomendacion = await crearRecomendacion(pool, emisor, receptor, contenido);
    await pool.query(
      "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, recomendacion_id) VALUES ($1, $2, 'recomendacion_recibida', $3)",
      [receptor, emisor, recomendacion],
    );

    await pool.query("DELETE FROM recomendacion WHERE id = $1", [recomendacion]);

    const { rows } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM notificacion",
    );
    expect(rows[0]?.total).toBe("0");
  });
});

describe("índices de búsqueda y de integridad", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function definicionDe(nombre: string): Promise<string> {
    const { rows } = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1",
      [nombre],
    );
    const definicion = rows[0]?.indexdef;
    if (definicion === undefined) {
      throw new Error(`No existe el índice ${nombre}`);
    }
    return definicion;
  }

  it("búsqueda por título con GIN y pg_trgm", async () => {
    expect(await definicionDe("contenido_titulo_trgm_idx")).toMatch(/USING gin .*gin_trgm_ops/);
  });

  it("username único sin distinguir mayúsculas", async () => {
    expect(await definicionDe("usuario_username_lower_key")).toMatch(
      /UNIQUE INDEX .*lower\(\(?username/,
    );
  });

  it("correo único sin distinguir mayúsculas y solo cuando existe", async () => {
    expect(await definicionDe("usuario_correo_lower_key")).toMatch(
      /UNIQUE INDEX .*lower\(\(?correo.*WHERE \(correo IS NOT NULL\)/,
    );
  });

  it("amistad única sobre el par de usuarios, sin importar el orden", async () => {
    expect(await definicionDe("amistad_par_key")).toMatch(/UNIQUE INDEX .*LEAST.*GREATEST/);
  });

  it("promedios: índice parcial sobre reseñas visibles", async () => {
    expect(await definicionDe("resena_contenido_visible_idx")).toMatch(/WHERE visible/);
  });

  it("notificaciones no leídas: índice por destinatario, lectura y fecha descendente", async () => {
    expect(await definicionDe("notificacion_destinatario_leida_idx")).toMatch(
      /fecha_creacion DESC/,
    );
  });
});
