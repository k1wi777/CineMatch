import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, REGLAS_DE_PRUEBA } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearContenido,
  crearGenero,
  crearResena,
  crearUsuario,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";
import { crearPoolComunidad } from "../../src/modules/comunidad/comunidad.servicio.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("recomendaciones generales de la comunidad (BE-11)", () => {
  let pool: pg.Pool;
  let contador = 0;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function titulo(
    nombre: string,
    popularidad: number | null,
    generos: number[] = [],
    tipo: "pelicula" | "serie" = "pelicula",
  ) {
    const id = await crearContenido(pool, tipo, `com-${nombre}-${Math.random()}`);
    await pool.query("UPDATE contenido SET titulo = $2, popularidad_externa = $3 WHERE id = $1", [
      id,
      nombre,
      popularidad,
    ]);
    for (const genero of generos) {
      await pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, $2)", [
        id,
        genero,
      ]);
    }
    return id;
  }

  // Añade `cantidad` reseñas de usuarios distintos con esa calificación. `ocultas` marca cuántas quedan ocultas.
  async function resenas(contenido: number, cantidad: number, calificacion: number, ocultas = 0) {
    for (let i = 0; i < cantidad; i++) {
      contador += 1;
      const usuario = await crearUsuario(pool, `com_autor_${contador}`);
      const id = await crearResena(pool, usuario, contenido, calificacion);
      if (i < ocultas) {
        await pool.query("UPDATE resena SET visible = false WHERE id = $1", [id]);
      }
    }
  }

  async function sesionDeVisor(a: ReturnType<typeof buildTestApp>) {
    await crearUsuarioConContrasena(pool, "com_visor", "com.visor@cinematch.test", CONTRASENA);
    return cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo: "com.visor@cinematch.test", contrasena: CONTRASENA }),
    );
  }

  async function recomendar(a: ReturnType<typeof buildTestApp>, cookie: string, query = "") {
    return request(a).get(`/api/community/recommendations${query}`).set("Cookie", cookie);
  }

  it("exige sesión", async () => {
    const a = buildTestApp(pool);

    expect((await request(a).get("/api/community/recommendations")).status).toBe(401);
  });

  it("arranque en frío: sin reseñas, rellena con popularidad y lo indica en el origen", async () => {
    const baja = await titulo("Baja", 10);
    const alta = await titulo("Alta", 90);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);

    const res = await recomendar(a, cookie);

    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([alta, baja]);
    expect(res.body.items.every((i: { origen: string }) => i.origen === "popularidad")).toBe(true);
  });

  it("el ranking comunitario exige el mínimo de calificaciones y marca su origen", async () => {
    const conCinco = await titulo("Con cinco", 5);
    const conCuatro = await titulo("Con cuatro", 99);
    await resenas(conCinco, REGLAS_DE_PRUEBA.COMMUNITY_MIN_RATINGS, 4);
    await resenas(conCuatro, REGLAS_DE_PRUEBA.COMMUNITY_MIN_RATINGS - 1, 5);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);

    const res = await recomendar(a, cookie);

    expect(res.body.items[0]).toMatchObject({
      id: conCinco,
      origen: "comunidad",
      promedio: 4,
      calificaciones: 5,
    });
    expect(res.body.items.find((i: { id: number }) => i.id === conCuatro)).toMatchObject({
      origen: "popularidad",
    });
  });

  it("desempata por más calificaciones y luego por popularidad", async () => {
    const pocas = await titulo("Pocas", 1);
    const muchas = await titulo("Muchas", 1);
    const empataPopular = await titulo("Empata popular", 50);
    const empataNormal = await titulo("Empata normal", 1);
    await resenas(pocas, 5, 4);
    await resenas(muchas, 6, 4);
    await resenas(empataPopular, 5, 3);
    await resenas(empataNormal, 5, 3);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);

    const res = await recomendar(a, cookie);

    expect(res.body.items.slice(0, 4).map((i: { id: number }) => i.id)).toEqual([
      muchas,
      pocas,
      empataPopular,
      empataNormal,
    ]);
  });

  it("las reseñas ocultas no cuentan para el ranking", async () => {
    const t = await titulo("Ocultas", 1);
    await resenas(t, 5, 5, 2);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);

    const res = await recomendar(a, cookie);

    expect(res.body.items.find((i: { id: number }) => i.id === t)?.origen).toBe("popularidad");
  });

  it("excluye los títulos que la persona ya vio o calificó", async () => {
    const vista = await titulo("Vista", 90);
    const calificada = await titulo("Calificada", 80);
    const libre = await titulo("Libre", 70);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);
    const visor = Number(
      (await pool.query("SELECT id FROM usuario WHERE username = 'com_visor'")).rows[0]?.id,
    );
    await pool.query(
      "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
      [visor, vista],
    );
    await crearResena(pool, visor, calificada, 3);

    const res = await recomendar(a, cookie);

    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([libre]);
  });

  it("prioriza los títulos que comparten géneros con sus intereses, manteniendo el orden dentro de cada bloque", async () => {
    const drama = await crearGenero(pool, "Drama");
    const terror = await crearGenero(pool, "Terror");
    const sinInteres = await titulo("Sin interes", 90, [terror]);
    const conInteres = await titulo("Con interes", 10, [drama]);
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);
    const visor = Number(
      (await pool.query("SELECT id FROM usuario WHERE username = 'com_visor'")).rows[0]?.id,
    );
    await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
      visor,
      drama,
    ]);

    const res = await recomendar(a, cookie);

    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([conInteres, sinInteres]);
  });

  it("el filtro por género usa solo los títulos de ese género; el de tipo también filtra", async () => {
    const accion = await crearGenero(pool, "Acción");
    const comedia = await crearGenero(pool, "Comedia");
    const deAccion = await titulo("De accion", 50, [accion]);
    const deComedia = await titulo("De comedia", 60, [comedia]);
    const serie = await titulo("Serie accion", 70, [accion], "serie");
    const a = buildTestApp(pool);
    const cookie = await sesionDeVisor(a);

    const porGenero = await recomendar(a, cookie, `?generoId=${accion}`);
    const porTipo = await recomendar(a, cookie, `?tipo=serie`);

    expect(porGenero.body.items.map((i: { id: number }) => i.id).sort()).toEqual(
      [deAccion, serie].sort(),
    );
    expect(porTipo.body.items.map((i: { id: number }) => i.id)).toEqual([serie]);
    expect(deComedia).toBeGreaterThan(0);
  });

  it("el pool se guarda en caché: dentro del TTL no cambia, al expirar se recalcula", async () => {
    let ahora = new Date("2026-03-01T10:00:00Z");
    const reloj = () => ahora;
    const a = buildTestApp(pool, undefined, false, { reloj });
    const cookie = await sesionDeVisor(a);
    await recomendar(a, cookie);
    const nueva = await titulo("Nueva", 1);
    await resenas(nueva, 5, 5);

    const dentroDelTtl = await recomendar(a, cookie);
    ahora = new Date(ahora.getTime() + (REGLAS_DE_PRUEBA.COMMUNITY_CACHE_TTL_MINUTES + 1) * 60_000);
    // La sesión caduca por inactividad con el mismo reloj: se vuelve a iniciar tras el salto.
    const cookieTras = cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo: "com.visor@cinematch.test", contrasena: CONTRASENA }),
    );
    const tras = await recomendar(a, cookieTras);

    // Dentro del TTL el pool no se recalcula: el título nuevo no aparece todavía.
    expect(dentroDelTtl.body.items.find((i: { id: number }) => i.id === nueva)).toBeUndefined();
    expect(tras.body.items.find((i: { id: number }) => i.id === nueva)?.origen).toBe("comunidad");
  });

  it("el recálculo manual actualiza el pool sin esperar al TTL", async () => {
    const reloj = () => new Date("2026-03-01T10:00:00Z");
    const cache = crearPoolComunidad({ pool, reglas: REGLAS_DE_PRUEBA, reloj });
    const t = await titulo("Manual", 1);
    await resenas(t, 5, 4);

    await cache.recalcular();

    expect(cache.obtener("global").comunidad.map((c) => c.id)).toEqual([t]);
  });
});
