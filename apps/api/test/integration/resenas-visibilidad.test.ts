import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearAmistad, crearContenido, crearResena, crearUsuario } from "../helpers/fixtures.js";
import {
  canViewerSee,
  filtroEtiquetasComunidad,
  filtroPromedioAmigos,
  filtroPromedioPublico,
  visibleReviewsFilter,
  type ResenaVisible,
} from "../../src/modules/resenas/visibilidad.js";

type Escenario = {
  autor: number;
  amigo: number;
  extrano: number;
  publica: number;
  amigos: number;
  oculta: number;
};

describe("regla de visibilidad de reseñas (BE-9.4)", () => {
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

  // Autor con tres reseñas (pública, solo amigos y oculta); amigo aceptado; extraño sin relación.
  async function escenario(): Promise<Escenario> {
    const autor = await crearUsuario(pool, "vis_autor");
    const amigo = await crearUsuario(pool, "vis_amigo");
    const extrano = await crearUsuario(pool, "vis_extrano");
    await crearAmistad(pool, autor, amigo);
    await pool.query("UPDATE amistad SET estado = 'aceptada'");
    const publica = await crearResena(pool, autor, await crearContenido(pool, "pelicula", "vis-1"));
    const amigos = await crearResena(pool, autor, await crearContenido(pool, "pelicula", "vis-2"));
    const oculta = await crearResena(pool, autor, await crearContenido(pool, "pelicula", "vis-3"));
    await pool.query("UPDATE resena SET visibilidad = 'amigos' WHERE id = $1", [amigos]);
    await pool.query("UPDATE resena SET visible = false WHERE id = $1", [oculta]);
    return { autor, amigo, extrano, publica, amigos, oculta };
  }

  // ¿Ve `espectador` la reseña según la consulta SQL?
  async function veSql(resenaId: number, espectador: number): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM resena r WHERE r.id = $1 AND ${visibleReviewsFilter({ alias: "r", espectadorParam: "$2" })}`,
      [resenaId, espectador],
    );
    return rows.length > 0;
  }

  // ¿Ve `espectador` la reseña según la función en memoria, con los mismos datos de la base?
  async function veMemoria(resenaId: number, espectador: number): Promise<boolean> {
    const { rows } = await pool.query<{
      usuario_id: number;
      visible: boolean;
      visibilidad: "publica" | "amigos";
    }>(`SELECT r.usuario_id, r.visible, r.visibilidad FROM resena r WHERE r.id = $1`, [resenaId]);
    const fila = rows[0];
    if (!fila) throw new Error("reseña inexistente en la prueba");
    const resena: ResenaVisible = {
      usuarioId: fila.usuario_id,
      visible: fila.visible,
      visibilidad: fila.visibilidad,
    };
    const sonAmigos = await pool.query(
      `SELECT 1 FROM amistad a WHERE a.estado = 'aceptada'
         AND LEAST(a.solicitante_id, a.receptor_id) = LEAST($1::int, $2::int)
         AND GREATEST(a.solicitante_id, a.receptor_id) = GREATEST($1::int, $2::int)`,
      [fila.usuario_id, espectador],
    );
    return canViewerSee(resena, espectador, sonAmigos.rows.length > 0);
  }

  describe("matriz de contenido: SQL y memoria dan el mismo resultado", () => {
    // Fila: tipo de reseña. Columnas: autor, amigo, no amigo.
    const esperado = {
      publica: { autor: true, amigo: true, extrano: true },
      amigos: { autor: true, amigo: true, extrano: false },
      oculta: { autor: true, amigo: false, extrano: false },
    } as const;

    it("pública: la ven todos", async () => {
      const e = await escenario();
      for (const [quien, id] of [
        ["autor", e.autor],
        ["amigo", e.amigo],
        ["extrano", e.extrano],
      ] as const) {
        expect(await veSql(e.publica, id), `SQL ${quien}`).toBe(esperado.publica[quien]);
        expect(await veMemoria(e.publica, id), `memoria ${quien}`).toBe(esperado.publica[quien]);
      }
    });

    it("solo amigos: la ve el autor y sus amigos, nunca un no amigo", async () => {
      const e = await escenario();
      for (const [quien, id] of [
        ["autor", e.autor],
        ["amigo", e.amigo],
        ["extrano", e.extrano],
      ] as const) {
        expect(await veSql(e.amigos, id), `SQL ${quien}`).toBe(esperado.amigos[quien]);
        expect(await veMemoria(e.amigos, id), `memoria ${quien}`).toBe(esperado.amigos[quien]);
      }
    });

    it("oculta: solo la ve el autor, marcada por moderación; amigos y no amigos no", async () => {
      const e = await escenario();
      for (const [quien, id] of [
        ["autor", e.autor],
        ["amigo", e.amigo],
        ["extrano", e.extrano],
      ] as const) {
        expect(await veSql(e.oculta, id), `SQL ${quien}`).toBe(esperado.oculta[quien]);
        expect(await veMemoria(e.oculta, id), `memoria ${quien}`).toBe(esperado.oculta[quien]);
      }
    });
  });

  describe("agregados", () => {
    it("promedio público: incluye pública y solo amigos, nunca la oculta", async () => {
      const e = await escenario();
      const { rows } = await pool.query(
        `SELECT r.id FROM resena r WHERE r.contenido_id IS NOT NULL AND ${filtroPromedioPublico("r")}`,
      );
      expect(rows.map((fila) => fila.id).sort()).toEqual([e.publica, e.amigos].sort());
    });

    it("promedio de amigos: solo reseñas de amigos del espectador", async () => {
      const e = await escenario();
      const paraAmigo = await pool.query(
        `SELECT r.id FROM resena r WHERE ${filtroPromedioAmigos({ alias: "r", espectadorParam: "$1" })}`,
        [e.amigo],
      );
      const paraExtrano = await pool.query(
        `SELECT r.id FROM resena r WHERE ${filtroPromedioAmigos({ alias: "r", espectadorParam: "$1" })}`,
        [e.extrano],
      );
      expect(paraAmigo.rows.map((fila) => fila.id).sort()).toEqual([e.publica, e.amigos].sort());
      expect(paraExtrano.rows).toHaveLength(0);
    });

    it("etiquetas de la comunidad: solo reseñas públicas y no ocultas", async () => {
      const e = await escenario();
      const { rows } = await pool.query(
        `SELECT r.id FROM resena r WHERE ${filtroEtiquetasComunidad("r")}`,
      );
      expect(rows.map((fila) => fila.id)).toEqual([e.publica]);
    });
  });

  describe("casos límite", () => {
    it("al eliminar la amistad, el amigo deja de ver las reseñas solo amigos", async () => {
      const e = await escenario();
      await pool.query("DELETE FROM amistad");

      expect(await veSql(e.amigos, e.amigo)).toBe(false);
      expect(await veMemoria(e.amigos, e.amigo)).toBe(false);
      expect(await veSql(e.publica, e.amigo)).toBe(true);
    });

    it("al cambiar la visibilidad a amigos, un no amigo deja de ver la reseña", async () => {
      const e = await escenario();
      await pool.query("UPDATE resena SET visibilidad = 'amigos' WHERE id = $1", [e.publica]);

      expect(await veSql(e.publica, e.extrano)).toBe(false);
      expect(await veMemoria(e.publica, e.extrano)).toBe(false);
    });

    it("las reseñas de un usuario eliminado siguen visibles para todos (BE-13.1)", async () => {
      const e = await escenario();
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [e.autor]);

      expect(await veSql(e.publica, e.amigo)).toBe(true);
      expect(await veSql(e.publica, e.extrano)).toBe(true);
      expect(await veMemoria(e.publica, e.extrano)).toBe(true);
    });
  });
});
