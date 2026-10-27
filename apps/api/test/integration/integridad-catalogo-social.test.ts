import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearGenero,
  crearResena,
  crearUsuario,
} from "../helpers/fixtures.js";

async function expectError(promesa: Promise<unknown>, codigo: string): Promise<void> {
  await expect(promesa).rejects.toMatchObject({ code: codigo });
}

describe("integridad de catálogo, amistades y reseñas (BE-1.3 y BE-1.4)", () => {
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

  describe("catálogo", () => {
    it("rechaza un género con nombre duplicado (23505)", async () => {
      await crearGenero(pool, "Drama");
      await expectError(crearGenero(pool, "Drama"), "23505");
    });

    it("rechaza el mismo título de la misma fuente y tipo (23505)", async () => {
      await crearContenido(pool, "pelicula", "100");
      await expectError(crearContenido(pool, "pelicula", "100"), "23505");
    });

    it("permite el mismo id externo como película y como serie", async () => {
      await crearContenido(pool, "pelicula", "100");
      await crearContenido(pool, "serie", "100");

      const { rows } = await pool.query<{ total: string }>(
        "SELECT count(*) AS total FROM contenido",
      );
      expect(rows[0]?.total).toBe("2");
    });

    it("rechaza un tipo de contenido fuera del enum (22P02)", async () => {
      await expectError(
        pool.query(
          "INSERT INTO contenido (tipo, titulo, fuente, id_externo, fecha_actualizacion) VALUES ('documental', 'x', 'tmdb', '1', now())",
        ),
        "22P02",
      );
    });

    it("rechaza un género inexistente asociado a un contenido (23503)", async () => {
      const contenido = await crearContenido(pool, "pelicula", "100");
      await expectError(
        pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, 999999)", [
          contenido,
        ]),
        "23503",
      );
    });

    it("rechaza un interés de usuario duplicado (23505)", async () => {
      const usuario = await crearUsuario(pool, "interes_user");
      const genero = await crearGenero(pool, "Comedia");
      await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
        usuario,
        genero,
      ]);
      await expectError(
        pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
          usuario,
          genero,
        ]),
        "23505",
      );
    });
  });

  describe("amistades", () => {
    it("rechaza la autoamistad (23514)", async () => {
      const usuario = await crearUsuario(pool, "solo");
      await expectError(crearAmistad(pool, usuario, usuario), "23514");
    });

    it("rechaza una solicitud duplicada (23505)", async () => {
      const ana = await crearUsuario(pool, "ana_amistad");
      const luis = await crearUsuario(pool, "luis_amistad");
      await crearAmistad(pool, ana, luis);
      await expectError(crearAmistad(pool, ana, luis), "23505");
    });

    it("rechaza la solicitud inversa de una amistad existente (23505)", async () => {
      const ana = await crearUsuario(pool, "ana_inversa");
      const luis = await crearUsuario(pool, "luis_inversa");
      await crearAmistad(pool, ana, luis);
      await expectError(crearAmistad(pool, luis, ana), "23505");
    });

    it("rechaza un estado de amistad fuera del enum (22P02)", async () => {
      const ana = await crearUsuario(pool, "ana_estado");
      const luis = await crearUsuario(pool, "luis_estado");
      await expectError(
        pool.query(
          "INSERT INTO amistad (solicitante_id, receptor_id, estado) VALUES ($1, $2, 'bloqueada')",
          [ana, luis],
        ),
        "22P02",
      );
    });
  });

  describe("reseñas, etiquetas y biblioteca", () => {
    it("rechaza una calificación fuera de rango (23514)", async () => {
      const usuario = await crearUsuario(pool, "rango");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await expectError(crearResena(pool, usuario, contenido, 0.5), "23514");
      await expectError(crearResena(pool, usuario, contenido, 5.5), "23514");
    });

    it("rechaza una calificación que no es paso de 0,5 (23514)", async () => {
      const usuario = await crearUsuario(pool, "paso");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await expectError(crearResena(pool, usuario, contenido, 4.3), "23514");
    });

    it("acepta calificaciones en pasos de 0,5", async () => {
      const usuario = await crearUsuario(pool, "pasos_validos");
      const calificaciones = [1, 3.5, 4.5, 5];
      for (const [indice, calificacion] of calificaciones.entries()) {
        const contenido = await crearContenido(pool, "pelicula", `paso-${indice}`);
        await expect(crearResena(pool, usuario, contenido, calificacion)).resolves.toEqual(
          expect.any(Number),
        );
      }
    });

    it("rechaza una segunda reseña del mismo usuario y título (23505)", async () => {
      const usuario = await crearUsuario(pool, "dos_resenas");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await crearResena(pool, usuario, contenido, 3);
      await expectError(crearResena(pool, usuario, contenido, 4), "23505");
    });

    it("rechaza un comentario de más de 2000 caracteres (23514)", async () => {
      const usuario = await crearUsuario(pool, "largo");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await expectError(
        pool.query(
          "INSERT INTO resena (usuario_id, contenido_id, calificacion, comentario, fecha_creacion) VALUES ($1, $2, 3, $3, now())",
          [usuario, contenido, "x".repeat(2001)],
        ),
        "23514",
      );
    });

    it("rechaza una etiqueta con texto duplicado (23505)", async () => {
      await pool.query("INSERT INTO etiqueta (texto) VALUES ('buena')");
      await expectError(pool.query("INSERT INTO etiqueta (texto) VALUES ('buena')"), "23505");
    });

    it("elimina las etiquetas de una reseña en cascada", async () => {
      const usuario = await crearUsuario(pool, "etiquetas");
      const contenido = await crearContenido(pool, "pelicula", "1");
      const resena = await crearResena(pool, usuario, contenido, 4);
      await pool.query("INSERT INTO etiqueta (texto) VALUES ('emotiva')");
      await pool.query(
        "INSERT INTO resena_etiqueta (resena_id, etiqueta_id) SELECT $1, id FROM etiqueta WHERE texto = 'emotiva'",
        [resena],
      );

      await pool.query("DELETE FROM resena WHERE id = $1", [resena]);

      const { rows } = await pool.query<{ total: string }>(
        "SELECT count(*) AS total FROM resena_etiqueta",
      );
      expect(rows[0]?.total).toBe("0");
    });

    it("rechaza un seguimiento duplicado del mismo título (23505)", async () => {
      const usuario = await crearUsuario(pool, "biblioteca");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await pool.query(
        "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'viendo')",
        [usuario, contenido],
      );
      await expectError(
        pool.query(
          "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
          [usuario, contenido],
        ),
        "23505",
      );
    });

    it("rechaza un estado de biblioteca fuera del enum (22P02)", async () => {
      const usuario = await crearUsuario(pool, "estado_biblioteca");
      const contenido = await crearContenido(pool, "pelicula", "1");
      await expectError(
        pool.query(
          "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'terminada')",
          [usuario, contenido],
        ),
        "22P02",
      );
    });
  });
});
