// Una prueba nombrada por regla de negocio del ERS (RN1–RN17). Cada nombre empieza por su código,
// para que la matriz de reglas se pueda seguir desde el ERS hasta la suite.
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearGenero,
  crearRecomendacion,
  crearResena,
  crearUsuario,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("reglas de negocio del ERS (RN1–RN17)", () => {
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

  // Usuario con contraseña y su sesión.
  async function persona(a: ReturnType<typeof buildTestApp>, nombre: string) {
    const id = await crearUsuarioConContrasena(pool, nombre, `${nombre}@reglas.test`, CONTRASENA);
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: `${nombre}@reglas.test`, contrasena: CONTRASENA });
    return { id, cookie: cookieDe(res) };
  }

  function escribir(
    a: ReturnType<typeof buildTestApp>,
    cookie: string,
    titulo: number,
    cuerpo: object,
  ) {
    return request(a)
      .put(`/api/titles/${titulo}/review`)
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send(cuerpo);
  }

  describe("reseñas, visibilidad y agregados", () => {
    it("RN1: calificación de 1 a 5 en pasos de 0,5 y una sola reseña por usuario y título", async () => {
      const a = buildTestApp(pool);
      const yo = await persona(a, "rn1_autor");
      const titulo = await crearContenido(pool, "pelicula", "rn1");

      const fuera = await escribir(a, yo.cookie, titulo, { calificacion: 0.5 });
      const medio = await escribir(a, yo.cookie, titulo, { calificacion: 1.5 });
      const repetida = await escribir(a, yo.cookie, titulo, { calificacion: 3 });
      const filas = await pool.query("SELECT count(*) AS n FROM resena WHERE usuario_id = $1", [
        yo.id,
      ]);

      expect(fuera.status).toBe(422);
      expect(medio.status).toBe(201);
      expect(repetida.status).toBe(200);
      expect(Number(filas.rows[0]?.n)).toBe(1);
    });

    it("RN2: calificar marca el título como vista en la biblioteca si no lo estaba", async () => {
      const a = buildTestApp(pool);
      const yo = await persona(a, "rn2_lector");
      const titulo = await crearContenido(pool, "pelicula", "rn2");

      await escribir(a, yo.cookie, titulo, { calificacion: 4 });
      const { rows } = await pool.query(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [yo.id, titulo],
      );

      expect(rows[0]?.estado).toBe("vista");
    });

    it("RN3: una reseña solo para amigos muestra comentario y autor únicamente a sus amigos", async () => {
      const a = buildTestApp(pool);
      const autor = await persona(a, "rn3_autor");
      const amigo = await persona(a, "rn3_amigo");
      const extrano = await persona(a, "rn3_extrano");
      await crearAmistad(pool, autor.id, amigo.id);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      const titulo = await crearContenido(pool, "pelicula", "rn3");
      await escribir(a, autor.cookie, titulo, {
        calificacion: 4,
        comentario: "Solo amigos",
        visibilidad: "amigos",
      });

      const delAmigo = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", amigo.cookie);
      const delExtrano = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", extrano.cookie);

      expect(delAmigo.body.items[0]).toMatchObject({
        comentario: "Solo amigos",
        autor: { username: "rn3_autor" },
      });
      expect(delExtrano.body.items).toHaveLength(0);
    });

    it("RN4: el promedio público es anónimo, incluye pública y solo amigos, y excluye las ocultas", async () => {
      const a = buildTestApp(pool);
      const lector = await persona(a, "rn4_lector");
      const titulo = await crearContenido(pool, "pelicula", "rn4");
      await crearResena(pool, await crearUsuario(pool, "rn4_uno"), titulo, 4);
      const dos = await crearResena(pool, await crearUsuario(pool, "rn4_dos"), titulo, 2);
      await pool.query("UPDATE resena SET visibilidad = 'amigos' WHERE id = $1", [dos]);
      const oculta = await crearResena(pool, await crearUsuario(pool, "rn4_tres"), titulo, 1);
      await pool.query("UPDATE resena SET visible = false WHERE id = $1", [oculta]);

      const res = await request(a).get(`/api/titles/${titulo}/stats`).set("Cookie", lector.cookie);

      expect(res.body).toMatchObject({ promedioPublico: 3, conteoPublico: 2 });
      expect(JSON.stringify(res.body)).not.toContain("rn4_uno");
    });

    it("RN5: la ficha muestra aparte el promedio de los amigos, con sus reseñas públicas y solo para amigos", async () => {
      const a = buildTestApp(pool);
      const yo = await persona(a, "rn5_yo");
      const amigo = await crearUsuario(pool, "rn5_amigo");
      const titulo = await crearContenido(pool, "pelicula", "rn5");
      await crearAmistad(pool, yo.id, amigo);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      await crearResena(pool, amigo, titulo, 4);
      await crearResena(pool, await crearUsuario(pool, "rn5_ajeno"), titulo, 1);

      const res = await request(a).get(`/api/titles/${titulo}/stats`).set("Cookie", yo.cookie);

      expect(res.body).toMatchObject({ promedioAmigos: 4, conteoAmigos: 1 });
    });

    it("RN6: hasta 5 etiquetas de máximo 30 caracteres, normalizadas, solo con comentario", async () => {
      const a = buildTestApp(pool);
      const yo = await persona(a, "rn6_autor");
      const titulo = await crearContenido(pool, "pelicula", "rn6");

      const seis = await escribir(a, yo.cookie, titulo, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["uno", "dos", "tres", "cuatro", "cinco", "seis"],
      });
      const larga = await escribir(a, yo.cookie, titulo, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["a".repeat(31)],
      });
      const normal = await escribir(a, yo.cookie, titulo, {
        calificacion: 4,
        comentario: "x",
        etiquetas: ["  Ciencia   FICCIÓN "],
      });

      expect(seis.status).toBe(422);
      expect(larga.status).toBe(422);
      expect(normal.body.etiquetas).toEqual(["ciencia ficcion"]);
    });

    it("RN7: las etiquetas de la comunidad aparecen desde 3 reseñas públicas, nunca desde las de solo amigos", async () => {
      const a = buildTestApp(pool);
      const lector = await persona(a, "rn7_lector");
      const titulo = await crearContenido(pool, "pelicula", "rn7");
      const etiquetar = async (
        texto: string,
        visibilidad: "publica" | "amigos",
        nombre: string,
      ) => {
        const resena = await crearResena(pool, await crearUsuario(pool, nombre), titulo, 4);
        await pool.query("UPDATE resena SET visibilidad = $2 WHERE id = $1", [resena, visibilidad]);
        await pool.query(
          "INSERT INTO etiqueta (texto) VALUES ($1) ON CONFLICT (texto) DO NOTHING",
          [texto],
        );
        await pool.query(
          "INSERT INTO resena_etiqueta (resena_id, etiqueta_id) SELECT $1, id FROM etiqueta WHERE texto = $2",
          [resena, texto],
        );
      };
      for (const nombre of ["rn7_a", "rn7_b", "rn7_c"]) await etiquetar("drama", "publica", nombre);
      for (const nombre of ["rn7_d", "rn7_e", "rn7_f"])
        await etiquetar("secreta", "amigos", nombre);

      const res = await request(a).get(`/api/titles/${titulo}/stats`).set("Cookie", lector.cookie);

      expect(res.body.etiquetasComunidad).toEqual([{ texto: "drama", veces: 3 }]);
    });

    it("RN8: una reseña marcada como spoiler devuelve el indicador para ocultar su comentario", async () => {
      const a = buildTestApp(pool);
      const autor = await persona(a, "rn8_autor");
      const lector = await persona(a, "rn8_lector");
      const titulo = await crearContenido(pool, "pelicula", "rn8");
      await escribir(a, autor.cookie, titulo, {
        calificacion: 4,
        comentario: "Final sorpresa",
        esSpoiler: true,
      });

      const res = await request(a)
        .get(`/api/titles/${titulo}/reviews`)
        .set("Cookie", lector.cookie);

      expect(res.body.items[0]).toMatchObject({ esSpoiler: true, comentario: "Final sorpresa" });
    });
  });

  describe("amistades, perfil y recomendaciones", () => {
    it("RN9: quien no es amigo ve solo los datos básicos y las reseñas públicas; el amigo, además, la biblioteca", async () => {
      const a = buildTestApp(pool);
      const autor = await persona(a, "rn9_autor");
      const amigo = await persona(a, "rn9_amigo");
      const extrano = await persona(a, "rn9_extrano");
      await crearAmistad(pool, autor.id, amigo.id);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");

      const delExtrano = await request(a)
        .get(`/api/users/${autor.id}/profile`)
        .set("Cookie", extrano.cookie);
      const delAmigo = await request(a)
        .get(`/api/users/${autor.id}/profile`)
        .set("Cookie", amigo.cookie);

      expect(delExtrano.body.biblioteca).toBeNull();
      expect(delExtrano.body.usuario).toMatchObject({ username: "rn9_autor" });
      expect(delAmigo.body.biblioteca).not.toBeNull();
    });

    it("RN10: no te agregas a ti mismo, no repites ni envías inversa, y una rechazada puede reenviarse", async () => {
      const a = buildTestApp(pool);
      const ana = await persona(a, "rn10_ana");
      const luis = await persona(a, "rn10_luis");
      const enviar = (cookie: string, usuarioId: number) =>
        request(a)
          .post("/api/friends/requests")
          .set("Origin", ORIGEN)
          .set("Cookie", cookie)
          .send({ usuarioId });

      const yo = await enviar(ana.cookie, ana.id);
      const primera = await enviar(ana.cookie, luis.id);
      const repetida = await enviar(ana.cookie, luis.id);
      const inversa = await enviar(luis.cookie, ana.id);
      await request(a)
        .post(`/api/friends/requests/${primera.body.id}/reject`)
        .set("Origin", ORIGEN)
        .set("Cookie", luis.cookie);
      const reenvio = await enviar(ana.cookie, luis.id);

      expect(yo.status).toBe(422);
      expect(primera.status).toBe(201);
      expect(repetida.status).toBe(409);
      expect(inversa.status).toBe(409);
      expect(reenvio.status).toBe(201);
    });

    it("RN11: solo se recomienda a amigos, una vez por emisor, receptor y título, con reseña propia y motivo de hasta 500", async () => {
      const a = buildTestApp(pool);
      const emisor = await persona(a, "rn11_emisor");
      const receptor = await persona(a, "rn11_receptor");
      const extrano = await persona(a, "rn11_extrano");
      await crearAmistad(pool, emisor.id, receptor.id);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");
      const titulo = await crearContenido(pool, "pelicula", "rn11");
      const otroTitulo = await crearContenido(pool, "pelicula", "rn11-otro");
      const ajena = await crearResena(pool, receptor.id, titulo, 5);
      const enviar = (cuerpo: object) =>
        request(a)
          .post("/api/recommendations")
          .set("Origin", ORIGEN)
          .set("Cookie", emisor.cookie)
          .send(cuerpo);

      const aExtrano = await enviar({ contentId: titulo, amigoId: extrano.id });
      const aMi = await enviar({ contentId: titulo, amigoId: emisor.id });
      const primera = await enviar({ contentId: titulo, amigoId: receptor.id });
      const repetida = await enviar({ contentId: titulo, amigoId: receptor.id });
      const motivoLargo = await enviar({
        contentId: otroTitulo,
        amigoId: receptor.id,
        motivo: "x".repeat(501),
      });
      const resenaAjena = await enviar({
        contentId: otroTitulo,
        amigoId: receptor.id,
        resenaId: ajena,
      });

      expect(aExtrano.status).toBe(403);
      expect(aMi.status).toBe(422);
      expect(primera.status).toBe(201);
      expect(repetida.status).toBe(409);
      expect(motivoLargo.status).toBe(422);
      expect(resenaAjena.status).toBe(422);
    });

    it("RN12: primero los amigos con géneros en común; fueraDeIntereses se guarda al enviar y no cambia después", async () => {
      const a = buildTestApp(pool);
      const emisor = await persona(a, "rn12_emisor");
      const conGenero = await persona(a, "rn12_con");
      const sinGenero = await persona(a, "rn12_sin");
      const drama = await crearGenero(pool, "Drama");
      const terror = await crearGenero(pool, "Terror");
      const titulo = await crearContenido(pool, "pelicula", "rn12");
      await pool.query("INSERT INTO contenido_genero (contenido_id, genero_id) VALUES ($1, $2)", [
        titulo,
        drama,
      ]);
      await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
        conGenero.id,
        drama,
      ]);
      await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
        sinGenero.id,
        terror,
      ]);
      await crearAmistad(pool, emisor.id, sinGenero.id);
      await crearAmistad(pool, emisor.id, conGenero.id);
      await pool.query("UPDATE amistad SET estado = 'aceptada'");

      const lista = await request(a)
        .get(`/api/titles/${titulo}/recommend/friends`)
        .set("Cookie", emisor.cookie);
      const envio = await request(a)
        .post("/api/recommendations")
        .set("Origin", ORIGEN)
        .set("Cookie", emisor.cookie)
        .send({ contentId: titulo, amigoId: sinGenero.id });
      await pool.query("DELETE FROM interes_usuario WHERE usuario_id = $1", [sinGenero.id]);
      await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
        sinGenero.id,
        drama,
      ]);
      const detalle = await request(a)
        .get(`/api/recommendations/${envio.body.id}`)
        .set("Cookie", emisor.cookie);

      expect(lista.body[0]).toMatchObject({ username: "rn12_con", generosEnComun: 1 });
      expect(envio.body.fueraDeIntereses).toBe(true);
      expect(detalle.body.fueraDeIntereses).toBe(true);
    });

    it("RN13: al crear la cuenta y en los intereses se exigen al menos 3 géneros", async () => {
      const a = buildTestApp(pool);
      const generos = [await crearGenero(pool, "Acción"), await crearGenero(pool, "Comedia")];
      const yo = await persona(a, "rn13_usuario");

      const registro = await request(a).post("/api/auth/register").set("Origin", ORIGEN).send({
        nombre: "Ana",
        username: "rn13_nueva",
        correo: "rn13@reglas.test",
        contrasena: "Clave1234",
        aceptaDatos: true,
        generoIds: generos,
      });
      const intereses = await request(a)
        .put("/api/users/me/interests")
        .set("Origin", ORIGEN)
        .set("Cookie", yo.cookie)
        .send({ generoIds: generos });

      expect(registro.status).toBe(422);
      expect(intereses.status).toBe(422);
    });

    it("RN14: al eliminar una reseña, las recomendaciones que la adjuntaban conservan el motivo", async () => {
      const a = buildTestApp(pool);
      const emisor = await persona(a, "rn14_emisor");
      const receptor = await crearUsuario(pool, "rn14_receptor");
      const titulo = await crearContenido(pool, "pelicula", "rn14");
      const creada = await escribir(a, emisor.cookie, titulo, {
        calificacion: 4,
        comentario: "Buena",
      });
      const recomendacion = await crearRecomendacion(pool, emisor.id, receptor, titulo);
      await pool.query(
        "UPDATE recomendacion SET resena_id = $1, motivo = 'Te gustará' WHERE id = $2",
        [creada.body.id, recomendacion],
      );

      await request(a)
        .delete(`/api/reviews/${creada.body.id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", emisor.cookie);
      const { rows } = await pool.query(
        "SELECT resena_id, motivo FROM recomendacion WHERE id = $1",
        [recomendacion],
      );

      expect(rows[0]).toEqual({ resena_id: null, motivo: "Te gustará" });
    });
  });

  describe("recomendaciones generales, catálogo y cuenta", () => {
    it("RN15: el ranking exige 5 calificaciones, excluye ocultas y lo ya visto, y completa con popularidad", async () => {
      const a = buildTestApp(pool);
      const yo = await persona(a, "rn15_visor");
      const elegible = await crearContenido(pool, "pelicula", "rn15-ok");
      const pocas = await crearContenido(pool, "pelicula", "rn15-pocas");
      const visto = await crearContenido(pool, "pelicula", "rn15-visto");
      for (let i = 0; i < 5; i++) {
        await crearResena(pool, await crearUsuario(pool, `rn15_ok_${i}`), elegible, 4);
      }
      await crearResena(pool, await crearUsuario(pool, "rn15_p"), pocas, 5);
      await pool.query(
        "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
        [yo.id, visto],
      );

      const res = await request(a).get("/api/community/recommendations").set("Cookie", yo.cookie);
      const ids = res.body.items.map((i: { id: number }) => i.id);

      expect(res.body.items[0]).toMatchObject({ id: elegible, origen: "comunidad" });
      expect(res.body.items.find((i: { id: number }) => i.id === pocas)?.origen).toBe(
        "popularidad",
      );
      expect(ids).not.toContain(visto);
    });

    it("RN16: una serie es una sola unidad (sin temporadas ni episodios) y el título se identifica por fuente, tipo e id externo", async () => {
      const tablas = await pool.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%temporada%' OR table_name ILIKE '%episodio%')",
      );
      const unicidad = await pool.query<{ conname: string }>(
        "SELECT conname FROM pg_constraint WHERE conrelid = 'contenido'::regclass AND contype = 'u'",
      );

      expect(tablas.rows).toHaveLength(0);
      expect(unicidad.rows.map((fila) => fila.conname)).toContain(
        "contenido_fuente_tipo_id_externo_key",
      );
    });

    it("RN17: el username tiene de 3 a 20 caracteres válidos y es único sin distinguir mayúsculas", async () => {
      const a = buildTestApp(pool);
      await crearUsuario(pool, "Ocupado_17");
      const generos = [
        await crearGenero(pool, "Acción"),
        await crearGenero(pool, "Comedia"),
        await crearGenero(pool, "Drama"),
      ];
      const registro = (username: string) =>
        request(a)
          .post("/api/auth/register")
          .set("Origin", ORIGEN)
          .send({
            nombre: "Ana",
            username,
            correo: `${username}@reglas.test`,
            contrasena: "Clave1234",
            aceptaDatos: true,
            generoIds: generos,
          });

      expect((await registro("ab")).status).toBe(422);
      expect((await registro("a".repeat(21))).status).toBe(422);
      expect((await registro("ocupado_17")).status).toBe(409);
      expect((await registro("Valido_17")).status).toBe(201);
    });
  });
});
