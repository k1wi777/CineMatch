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

// Matriz de privacidad (BE-9.8): el mismo autor con tres reseñas, vista por el autor, un amigo y un extraño,
// a través de cada consumidor: listado, agregados, reseñas de usuario y perfil.
describe("matriz de privacidad de reseñas y perfil (BE-9.8 y BE-9.9)", () => {
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

  async function escenario() {
    const titulo = await crearContenido(pool, "pelicula", "matriz-1");
    const autor = await crearUsuarioConContrasena(
      pool,
      "matriz_autor",
      "matriz.autor@cinematch.test",
      CONTRASENA,
    );
    const amigo = await crearUsuarioConContrasena(
      pool,
      "matriz_amigo",
      "matriz.amigo@cinematch.test",
      CONTRASENA,
    );
    const extrano = await crearUsuarioConContrasena(
      pool,
      "matriz_extrano",
      "matriz.extrano@cinematch.test",
      CONTRASENA,
    );
    await crearAmistad(pool, autor, amigo);
    await pool.query("UPDATE amistad SET estado = 'aceptada'");

    // Autor: pública (calificación 4), solo amigos (2) y oculta (5). Las tres sobre el mismo título no es posible (RN1),
    // así que el autor usa tres títulos y el consumidor de listado del título principal ve la pública y la de amigos vía otro título.
    const otroTitulo = await crearContenido(pool, "pelicula", "matriz-2");
    const tercerTitulo = await crearContenido(pool, "pelicula", "matriz-3");
    const publica = await crearResena(pool, autor, titulo, 4);
    await pool.query("UPDATE resena SET comentario = 'pública' WHERE id = $1", [publica]);
    const amigos = await crearResena(pool, autor, otroTitulo, 2);
    await pool.query(
      "UPDATE resena SET comentario = 'solo amigos', visibilidad = 'amigos' WHERE id = $1",
      [amigos],
    );
    const oculta = await crearResena(pool, autor, tercerTitulo, 5);
    await pool.query("UPDATE resena SET comentario = 'oculta', visible = false WHERE id = $1", [
      oculta,
    ]);

    const a = buildTestApp(pool);
    const sesion = async (correo: string) =>
      cookieDe(
        await request(a)
          .post("/api/auth/login")
          .set("Origin", ORIGEN)
          .send({ correo, contrasena: CONTRASENA }),
      );
    return {
      a,
      autor,
      amigo,
      extrano,
      titulo,
      otroTitulo,
      tercerTitulo,
      publica,
      amigos,
      oculta,
      cookieAutor: await sesion("matriz.autor@cinematch.test"),
      cookieAmigo: await sesion("matriz.amigo@cinematch.test"),
      cookieExtrano: await sesion("matriz.extrano@cinematch.test"),
    };
  }

  const comentarios = (items: { comentario: string }[]) => items.map((i) => i.comentario).sort();

  it("el listado de un título muestra a cada espectador solo lo que le corresponde (el autor ve la suya aparte)", async () => {
    const e = await escenario();

    const delAmigo = await request(e.a)
      .get(`/api/titles/${e.otroTitulo}/reviews`)
      .set("Cookie", e.cookieAmigo);
    const delExtrano = await request(e.a)
      .get(`/api/titles/${e.otroTitulo}/reviews`)
      .set("Cookie", e.cookieExtrano);
    const delAutor = await request(e.a)
      .get(`/api/titles/${e.otroTitulo}/reviews`)
      .set("Cookie", e.cookieAutor);

    expect(comentarios(delAmigo.body.items)).toEqual(["solo amigos"]);
    expect(delExtrano.body.items).toHaveLength(0);
    expect(delAutor.body.items).toHaveLength(0);
    expect(delAutor.body.miResena).toMatchObject({
      comentario: "solo amigos",
      ocultaPorModeracion: false,
    });
  });

  it("la reseña oculta solo aparece, marcada, en la propia reseña del autor", async () => {
    const e = await escenario();

    const delAutor = await request(e.a)
      .get(`/api/titles/${e.tercerTitulo}/reviews`)
      .set("Cookie", e.cookieAutor);
    const delAmigo = await request(e.a)
      .get(`/api/titles/${e.tercerTitulo}/reviews`)
      .set("Cookie", e.cookieAmigo);

    expect(delAutor.body.miResena).toMatchObject({
      comentario: "oculta",
      ocultaPorModeracion: true,
    });
    expect(delAmigo.body.items).toHaveLength(0);
    expect(delAmigo.body.miResena).toBeNull();
  });

  it("los agregados: la oculta nunca cuenta; el promedio de amigos solo cuenta a los amigos del espectador", async () => {
    const e = await escenario();

    const paraExtrano = await request(e.a)
      .get(`/api/titles/${e.otroTitulo}/stats`)
      .set("Cookie", e.cookieExtrano);
    const paraAmigo = await request(e.a)
      .get(`/api/titles/${e.otroTitulo}/stats`)
      .set("Cookie", e.cookieAmigo);
    const paraExtranoPrincipal = await request(e.a)
      .get(`/api/titles/${e.titulo}/stats`)
      .set("Cookie", e.cookieExtrano);

    expect(paraExtrano.body).toMatchObject({
      promedioPublico: 2,
      conteoPublico: 1,
      promedioAmigos: null,
      conteoAmigos: 0,
    });
    expect(paraAmigo.body).toMatchObject({ promedioAmigos: 2, conteoAmigos: 1 });
    expect(paraExtranoPrincipal.body).toMatchObject({ promedioPublico: 4, conteoPublico: 1 });
    expect(paraExtrano.body.etiquetasComunidad).toEqual([]);
  });

  it("el perfil: un extraño ve lo público; un amigo ve además la biblioteca y las reseñas para amigos", async () => {
    const e = await escenario();

    const extrano = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieExtrano);
    const amigo = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieAmigo);
    const propio = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieAutor);

    expect(extrano.body.relacion).toBe("ninguna");
    expect(extrano.body.biblioteca).toBeNull();
    expect(comentarios(extrano.body.resenas.items)).toEqual(["pública"]);
    expect(amigo.body.relacion).toBe("amigos");
    expect(amigo.body.biblioteca).not.toBeNull();
    expect(comentarios(amigo.body.resenas.items)).toEqual(["pública", "solo amigos"]);
    expect(propio.body.esPropio).toBe(true);
    expect(comentarios(propio.body.resenas.items)).toEqual(["oculta", "pública", "solo amigos"]);
  });

  it("cambiar la visibilidad a amigos retira la reseña al extraño en listado, agregados y perfil", async () => {
    const e = await escenario();
    await pool.query("UPDATE resena SET visibilidad = 'amigos' WHERE id = $1", [e.publica]);

    const listado = await request(e.a)
      .get(`/api/titles/${e.titulo}/reviews`)
      .set("Cookie", e.cookieExtrano);
    const stats = await request(e.a)
      .get(`/api/titles/${e.titulo}/stats`)
      .set("Cookie", e.cookieExtrano);
    const perfil = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieExtrano);

    expect(listado.body.items).toHaveLength(0);
    expect(stats.body.conteoPublico).toBe(1);
    expect(comentarios(perfil.body.resenas.items)).toEqual([]);
  });

  it("al eliminar la amistad, el antiguo amigo pierde la biblioteca y las reseñas para amigos", async () => {
    const e = await escenario();
    await pool.query("DELETE FROM amistad");

    const perfil = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieAmigo);

    expect(perfil.body.relacion).toBe("ninguna");
    expect(perfil.body.biblioteca).toBeNull();
    expect(comentarios(perfil.body.resenas.items)).toEqual(["pública"]);
  });

  it("un autor eliminado: su perfil devuelve 404 y nadie más ve sus reseñas", async () => {
    const e = await escenario();
    await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [e.autor]);

    const perfil = await request(e.a)
      .get(`/api/users/${e.autor}/profile`)
      .set("Cookie", e.cookieAmigo);
    const listado = await request(e.a)
      .get(`/api/titles/${e.titulo}/reviews`)
      .set("Cookie", e.cookieExtrano);
    const stats = await request(e.a)
      .get(`/api/titles/${e.titulo}/stats`)
      .set("Cookie", e.cookieExtrano);

    expect(perfil.status).toBe(404);
    expect(listado.body.items).toHaveLength(0);
    expect(stats.body.conteoPublico).toBe(0);
  });

  it("el perfil de un usuario inexistente devuelve 404", async () => {
    const e = await escenario();

    const res = await request(e.a).get("/api/users/999999/profile").set("Cookie", e.cookieExtrano);

    expect(res.status).toBe(404);
  });
});
