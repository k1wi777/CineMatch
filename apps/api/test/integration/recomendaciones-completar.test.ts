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

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("completar recomendaciones al calificar por primera vez (BE-10.6)", () => {
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

  // Receptor (Rubén) con tres recomendaciones del mismo título: enviada, aceptada y descartada.
  async function escenario() {
    const titulo = await crearContenido(pool, "pelicula", "completar-1");
    const receptor = await crearUsuarioConContrasena(
      pool,
      "ruben_compl",
      "ruben.compl@cinematch.test",
      CONTRASENA,
    );
    const emisorUno = await crearUsuarioConContrasena(
      pool,
      "emisor_uno",
      "emisor.uno@cinematch.test",
      CONTRASENA,
    );
    const emisorDos = await crearUsuarioConContrasena(
      pool,
      "emisor_dos",
      "emisor.dos@cinematch.test",
      CONTRASENA,
    );
    const emisorTres = await crearUsuarioConContrasena(
      pool,
      "emisor_tres",
      "emisor.tres@cinematch.test",
      CONTRASENA,
    );
    const enviada = await crearRecomendacion(pool, emisorUno, receptor, titulo);
    const aceptada = await crearRecomendacion(pool, emisorDos, receptor, titulo);
    const descartada = await crearRecomendacion(pool, emisorTres, receptor, titulo);
    await pool.query("UPDATE recomendacion SET estado = 'aceptada' WHERE id = $1", [aceptada]);
    await pool.query("UPDATE recomendacion SET estado = 'descartada' WHERE id = $1", [descartada]);
    const a = buildTestApp(pool);
    const cookie = cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo: "ruben.compl@cinematch.test", contrasena: CONTRASENA }),
    );
    return {
      a,
      titulo,
      receptor,
      emisorUno,
      emisorDos,
      emisorTres,
      enviada,
      aceptada,
      descartada,
      cookie,
    };
  }

  async function estadoDe(id: number): Promise<string | undefined> {
    const { rows } = await pool.query<{ estado: string }>(
      "SELECT estado FROM recomendacion WHERE id = $1",
      [id],
    );
    return rows[0]?.estado;
  }

  async function notificacionesCompletadas(emisor: number): Promise<number> {
    const { rows } = await pool.query(
      "SELECT count(*) AS total FROM notificacion WHERE usuario_destinatario_id = $1 AND tipo = 'recomendacion_completada'",
      [emisor],
    );
    return Number(rows[0]?.total);
  }

  it("al calificar por primera vez, las enviadas y aceptadas pasan a completada, las descartadas no, y cada emisor recibe un aviso", async () => {
    const e = await escenario();

    const res = await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie)
      .send({ calificacion: 4 });

    expect(res.status).toBe(201);
    expect(await estadoDe(e.enviada)).toBe("completada");
    expect(await estadoDe(e.aceptada)).toBe("completada");
    expect(await estadoDe(e.descartada)).toBe("descartada");
    expect(await notificacionesCompletadas(e.emisorUno)).toBe(1);
    expect(await notificacionesCompletadas(e.emisorDos)).toBe(1);
    expect(await notificacionesCompletadas(e.emisorTres)).toBe(0);
    const fecha = await pool.query("SELECT fecha_completado FROM recomendacion WHERE id = $1", [
      e.enviada,
    ]);
    expect(fecha.rows[0]?.fecha_completado).not.toBeNull();
  });

  it("editar la reseña no vuelve a completar nada ni avisa de nuevo", async () => {
    const e = await escenario();
    await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie)
      .send({ calificacion: 4 });
    const emisorCuatro = await crearUsuarioConContrasena(
      pool,
      "emisor_cuatro",
      "emisor.cuatro@cinematch.test",
      CONTRASENA,
    );
    const nueva = await crearRecomendacion(pool, emisorCuatro, e.receptor, e.titulo);

    await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie)
      .send({ calificacion: 2 });

    expect(await estadoDe(nueva)).toBe("enviada");
    expect(await notificacionesCompletadas(emisorCuatro)).toBe(0);
  });

  it("marcar el título como vista sin calificar no completa nada", async () => {
    const e = await escenario();

    await request(e.a)
      .put(`/api/library/${e.titulo}`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie)
      .send({ estado: "vista" });

    expect(await estadoDe(e.enviada)).toBe("enviada");
    expect(await estadoDe(e.aceptada)).toBe("aceptada");
  });

  it("si falla la creación de una notificación, se revierten la reseña, la biblioteca y los estados", async () => {
    const e = await escenario();
    await pool.query(`
      CREATE OR REPLACE FUNCTION fallo_notificacion_completada() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo forzado en la prueba'; END;
      $$ LANGUAGE plpgsql`);
    await pool.query(`
      CREATE TRIGGER fallo_notificacion_completada BEFORE INSERT ON notificacion
      FOR EACH ROW WHEN (NEW.tipo = 'recomendacion_completada')
      EXECUTE FUNCTION fallo_notificacion_completada()`);

    try {
      const res = await request(e.a)
        .put(`/api/titles/${e.titulo}/review`)
        .set("Origin", ORIGEN)
        .set("Cookie", e.cookie)
        .send({ calificacion: 4 });

      expect(res.status).toBe(500);
      const resenas = await pool.query(
        "SELECT count(*) AS total FROM resena WHERE usuario_id = $1",
        [e.receptor],
      );
      const biblioteca = await pool.query("SELECT 1 FROM seguimiento WHERE usuario_id = $1", [
        e.receptor,
      ]);
      expect(Number(resenas.rows[0]?.total)).toBe(0);
      expect(biblioteca.rows).toHaveLength(0);
      expect(await estadoDe(e.enviada)).toBe("enviada");
      expect(await estadoDe(e.aceptada)).toBe("aceptada");
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS fallo_notificacion_completada ON notificacion");
      await pool.query("DROP FUNCTION IF EXISTS fallo_notificacion_completada()");
    }
  });

  it("si el receptor elimina su reseña, la recomendación sigue completada y sin reseña adjunta", async () => {
    const e = await escenario();
    const creada = await request(e.a)
      .put(`/api/titles/${e.titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie)
      .send({ calificacion: 4, comentario: "Buena" });

    await request(e.a)
      .delete(`/api/reviews/${creada.body.id}`)
      .set("Origin", ORIGEN)
      .set("Cookie", e.cookie);

    expect(await estadoDe(e.enviada)).toBe("completada");
  });
});
