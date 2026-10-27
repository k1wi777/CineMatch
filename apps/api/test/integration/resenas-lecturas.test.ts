import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearResena,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("lecturas de reseñas: agregados, listados y reseñas de usuario (BE-9.5 a BE-9.7)", () => {
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

  // Crea una reseña con comentario, visibilidad y etiquetas. Devuelve su id.
  async function resena(
    usuario: number,
    contenido: number,
    datos: {
      calificacion: number;
      comentario?: string | null;
      visibilidad?: "publica" | "amigos";
      visible?: boolean;
      etiquetas?: string[];
    },
  ): Promise<number> {
    const id = await crearResena(pool, usuario, contenido, datos.calificacion);
    await pool.query(
      "UPDATE resena SET comentario = $2, visibilidad = $3, visible = $4 WHERE id = $1",
      [
        id,
        datos.comentario === undefined ? "comentario" : datos.comentario,
        datos.visibilidad ?? "publica",
        datos.visible ?? true,
      ],
    );
    for (const texto of datos.etiquetas ?? []) {
      const { rows } = await pool.query<{ id: number }>(
        "INSERT INTO etiqueta (texto) VALUES ($1) ON CONFLICT (texto) DO UPDATE SET texto = EXCLUDED.texto RETURNING id",
        [texto],
      );
      await pool.query("INSERT INTO resena_etiqueta (resena_id, etiqueta_id) VALUES ($1, $2)", [
        id,
        rows[0]?.id,
      ]);
    }
    return id;
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>, correo: string): Promise<string> {
    return cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo, contrasena: CONTRASENA }),
    );
  }

  it("exige sesión en todas las lecturas", async () => {
    const a = buildTestApp(pool);

    const respuestas = await Promise.all([
      request(a).get("/api/titles/1/stats"),
      request(a).get("/api/titles/1/reviews"),
      request(a).get("/api/users/me/reviews"),
      request(a).get("/api/users/1/reviews"),
    ]);

    expect(respuestas.every((res) => res.status === 401)).toBe(true);
  });

  describe("agregados de la ficha (BE-9.5)", () => {
    it("promedio y conteo públicos incluyen las no ocultas, y el de amigos solo a los amigos del espectador", async () => {
      const titulo = await crearContenido(pool, "pelicula", "stats-1");
      const autor = await crearUsuarioConContrasena(
        pool,
        "stats_autor",
        "stats.autor@cinematch.test",
        CONTRASENA,
      );
      const amiga = await crearUsuarioConContrasena(
        pool,
        "stats_amiga",
        "stats.amiga@cinematch.test",
        CONTRASENA,
      );
      const oculta = await crearUsuarioConContrasena(
        pool,
        "stats_oculta",
        "stats.oculta@cinematch.test",
        CONTRASENA,
      );
      const espectador = await crearUsuarioConContrasena(
        pool,
        "stats_espectador",
        "stats.esp@cinematch.test",
        CONTRASENA,
      );
      await crearAmistad(pool, espectador, amiga);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      await resena(autor, titulo, { calificacion: 4 });
      await resena(amiga, titulo, { calificacion: 2, visibilidad: "amigos" });
      await resena(oculta, titulo, { calificacion: 5, visible: false });
      const a = buildTestApp(pool);

      const res = await request(a)
        .get(`/api/titles/${titulo}/stats`)
        .set("Cookie", await sesionDe(a, "stats.esp@cinematch.test"));

      expect(res.body).toMatchObject({
        promedioPublico: 3,
        conteoPublico: 2,
        promedioAmigos: 2,
        conteoAmigos: 1,
      });
    });

    it("sin amigos con reseña, el promedio de amigos se omite (null)", async () => {
      const titulo = await crearContenido(pool, "pelicula", "stats-2");
      const autor = await crearUsuarioConContrasena(
        pool,
        "stats2_autor",
        "stats2.autor@cinematch.test",
        CONTRASENA,
      );
      await crearUsuarioConContrasena(pool, "stats2_esp", "stats2.esp@cinematch.test", CONTRASENA);
      await resena(autor, titulo, { calificacion: 4 });
      const a = buildTestApp(pool);

      const res = await request(a)
        .get(`/api/titles/${titulo}/stats`)
        .set("Cookie", await sesionDe(a, "stats2.esp@cinematch.test"));

      expect(res.body.promedioAmigos).toBeNull();
      expect(res.body.conteoAmigos).toBe(0);
    });

    it("las etiquetas de la comunidad aparecen desde TAG_MIN_REVIEWS reseñas públicas no ocultas", async () => {
      const titulo = await crearContenido(pool, "pelicula", "stats-3");
      const espectador = await crearUsuarioConContrasena(
        pool,
        "stats3_esp",
        "stats3.esp@cinematch.test",
        CONTRASENA,
      );
      for (let i = 1; i <= 3; i++) {
        const autor = await crearUsuarioConContrasena(
          pool,
          `stats3_autor_${i}`,
          `stats3.a${i}@cinematch.test`,
          CONTRASENA,
        );
        await resena(autor, titulo, { calificacion: 4, etiquetas: ["drama"] });
      }
      const pocas = await crearUsuarioConContrasena(
        pool,
        "stats3_pocas",
        "stats3.pocas@cinematch.test",
        CONTRASENA,
      );
      await resena(pocas, titulo, { calificacion: 4, etiquetas: ["romance"] });
      const a = buildTestApp(pool);
      void espectador;

      const res = await request(a)
        .get(`/api/titles/${titulo}/stats`)
        .set("Cookie", await sesionDe(a, "stats3.esp@cinematch.test"));

      expect(res.body.etiquetasComunidad).toEqual([{ texto: "drama", veces: 3 }]);
    });
  });

  describe("listado de reseñas de un título (BE-9.6)", () => {
    it("solo reseñas con comentario que el espectador puede ver", async () => {
      const titulo = await crearContenido(pool, "pelicula", "lista-1");
      const autor = await crearUsuarioConContrasena(
        pool,
        "lista_autor",
        "lista.autor@cinematch.test",
        CONTRASENA,
      );
      const amiga = await crearUsuarioConContrasena(
        pool,
        "lista_amiga",
        "lista.amiga@cinematch.test",
        CONTRASENA,
      );
      const extrano = await crearUsuarioConContrasena(
        pool,
        "lista_extrano",
        "lista.extrano@cinematch.test",
        CONTRASENA,
      );
      void extrano;
      await crearAmistad(pool, amiga, autor);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      await resena(autor, titulo, { calificacion: 4, comentario: "publica" });
      const autorSinComentario = await crearUsuarioConContrasena(
        pool,
        "lista_autor2",
        "lista.autor2@cinematch.test",
        CONTRASENA,
      );
      await resena(autorSinComentario, titulo, { calificacion: 3, comentario: null });
      const otro = await crearUsuarioConContrasena(
        pool,
        "lista_otro",
        "lista.otro@cinematch.test",
        CONTRASENA,
      );
      await resena(otro, titulo, {
        calificacion: 2,
        comentario: "solo amigos",
        visibilidad: "amigos",
      });
      // La amiga es amiga de quien escribió "solo amigos": debe verla.
      await crearAmistad(pool, amiga, otro);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      const a = buildTestApp(pool);

      const deExtrano = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", await sesionDe(a, "lista.extrano@cinematch.test"));
      const deAmiga = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", await sesionDe(a, "lista.amiga@cinematch.test"));

      expect(deExtrano.body.items.map((i: { comentario: string }) => i.comentario)).toEqual([
        "publica",
      ]);
      expect(deAmiga.body.items.map((i: { comentario: string }) => i.comentario).sort()).toEqual(
        ["publica", "solo amigos"].sort(),
      );
      expect(deExtrano.body.items[0].autor.username).toBe("lista_autor");
    });

    it("devuelve aparte la propia reseña, marcada si fue ocultada por moderación", async () => {
      const titulo = await crearContenido(pool, "pelicula", "lista-2");
      const yo = await crearUsuarioConContrasena(
        pool,
        "lista_yo",
        "lista.yo@cinematch.test",
        CONTRASENA,
      );
      await resena(yo, titulo, { calificacion: 1, comentario: "oculta", visible: false });
      const a = buildTestApp(pool);

      const res = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", await sesionDe(a, "lista.yo@cinematch.test"));

      expect(res.body.items).toHaveLength(0);
      expect(res.body.miResena).toMatchObject({ comentario: "oculta", ocultaPorModeracion: true });
    });
  });

  describe("reseñas de un usuario (BE-9.7)", () => {
    it("el propio usuario ve todas las suyas; un amigo las que son para amigos; un extraño solo las públicas", async () => {
      const titulo = await crearContenido(pool, "pelicula", "usuario-1");
      const titulo2 = await crearContenido(pool, "pelicula", "usuario-2");
      const titulo3 = await crearContenido(pool, "pelicula", "usuario-3");
      const autor = await crearUsuarioConContrasena(
        pool,
        "resenas_autor",
        "resenas.autor@cinematch.test",
        CONTRASENA,
      );
      const amigo = await crearUsuarioConContrasena(
        pool,
        "resenas_amigo",
        "resenas.amigo@cinematch.test",
        CONTRASENA,
      );
      const extrano = await crearUsuarioConContrasena(
        pool,
        "resenas_extrano",
        "resenas.extrano@cinematch.test",
        CONTRASENA,
      );
      void extrano;
      await crearAmistad(pool, autor, amigo);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      await resena(autor, titulo, { calificacion: 4, comentario: "publica" });
      await resena(autor, titulo2, {
        calificacion: 3,
        comentario: "amigos",
        visibilidad: "amigos",
      });
      await resena(autor, titulo3, { calificacion: 2, comentario: "oculta", visible: false });
      const a = buildTestApp(pool);

      const propias = await request(a)
        .get("/api/users/me/reviews")
        .set("Cookie", await sesionDe(a, "resenas.autor@cinematch.test"));
      const deAmigo = await request(a)
        .get(`/api/users/${autor}/reviews`)
        .set("Cookie", await sesionDe(a, "resenas.amigo@cinematch.test"));
      const deExtrano = await request(a)
        .get(`/api/users/${autor}/reviews`)
        .set("Cookie", await sesionDe(a, "resenas.extrano@cinematch.test"));

      expect(propias.body.total).toBe(3);
      expect(deAmigo.body.total).toBe(2);
      expect(deExtrano.body.items.map((i: { comentario: string }) => i.comentario)).toEqual([
        "publica",
      ]);
      expect(deExtrano.body.items[0].contenido).toMatchObject({
        id: titulo,
        titulo: expect.any(String),
      });
    });

    it("si el autor se elimina, sus reseñas siguen visibles con el autor anonimizado (BE-13.1)", async () => {
      const titulo = await crearContenido(pool, "pelicula", "usuario-borrado");
      const autor = await crearUsuarioConContrasena(
        pool,
        "resenas_borrado",
        "resenas.borrado@cinematch.test",
        CONTRASENA,
      );
      await crearUsuarioConContrasena(
        pool,
        "resenas_lector",
        "resenas.lector@cinematch.test",
        CONTRASENA,
      );
      await resena(autor, titulo, { calificacion: 4, comentario: "mía" });
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [autor]);
      const a = buildTestApp(pool);

      const lector = await request(a)
        .get(`/api/users/${autor}/reviews`)
        .set("Cookie", await sesionDe(a, "resenas.lector@cinematch.test"));

      expect(lector.body.total).toBe(1);
    });
  });
});
