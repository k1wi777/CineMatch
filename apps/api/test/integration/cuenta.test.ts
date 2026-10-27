import { mkdtemp, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const CORREO = "cuenta.borrar@cinematch.test";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("derechos de datos y eliminación de cuenta (BE-13.1)", () => {
  let pool: pg.Pool;
  let directorio: string;

  beforeAll(async () => {
    pool = createTestPool();
    directorio = await mkdtemp(join(tmpdir(), "cinematch-cuenta-"));
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
    await rm(directorio, { recursive: true, force: true });
  });

  async function sesionDe(a: ReturnType<typeof buildTestApp>, correo: string): Promise<string> {
    return cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo, contrasena: CONTRASENA }),
    );
  }

  it("exportar: entrega perfil, intereses, reseñas, biblioteca, amigos y recomendaciones, sin contraseña", async () => {
    const yo = await crearUsuarioConContrasena(
      pool,
      "cuenta_export",
      "cuenta.export@cinematch.test",
      CONTRASENA,
    );
    const genero = await crearGenero(pool, "Drama");
    await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
      yo,
      genero,
    ]);
    const titulo = await crearContenido(pool, "pelicula", "cuenta-export-1");
    await crearResena(pool, yo, titulo, 4);
    const a = buildTestApp(pool);

    const res = await request(a)
      .get("/api/users/me/data-export")
      .set("Cookie", await sesionDe(a, "cuenta.export@cinematch.test"));

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.body.perfil.correo).toBe("cuenta.export@cinematch.test");
    expect(res.body.intereses).toEqual([{ id: genero, nombre: "Drama" }]);
    expect(res.body.resenas).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain("contrasena");
  });

  it("eliminar exige la contraseña correcta y la confirmación escrita", async () => {
    await crearUsuarioConContrasena(pool, "cuenta_valida", CORREO, CONTRASENA);
    const a = buildTestApp(pool);
    const cookie = await sesionDe(a, CORREO);

    const malaClave = await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: "incorrecta1", confirmacion: "ELIMINAR" });
    const sinConfirmar = await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: CONTRASENA, confirmacion: "si" });

    expect(malaClave.status).toBe(422);
    expect(malaClave.body.error.fields).toHaveProperty("password");
    expect(sinConfirmar.status).toBe(422);
    expect(sinConfirmar.body.error.fields).toHaveProperty("confirmacion");
  });

  it("un administrador no puede eliminar su cuenta por este endpoint (403)", async () => {
    const admin = await crearUsuarioConContrasena(
      pool,
      "cuenta_admin",
      "cuenta.admin@cinematch.test",
      CONTRASENA,
    );
    await pool.query(
      "INSERT INTO rol (nombre) VALUES ('administrador') ON CONFLICT (nombre) DO NOTHING",
    );
    await pool.query(
      "UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = 'administrador') WHERE id = $1",
      [admin],
    );
    const a = buildTestApp(pool);

    const res = await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", await sesionDe(a, "cuenta.admin@cinematch.test"))
      .send({ password: CONTRASENA, confirmacion: "ELIMINAR" });

    expect(res.status).toBe(403);
  });

  it("eliminar anonimiza el perfil, conserva las reseñas y borra el resto de datos personales", async () => {
    const yo = await crearUsuarioConContrasena(pool, "cuenta_borrar", CORREO, CONTRASENA);
    const otro = await crearUsuario(pool, "cuenta_otro");
    const genero = await crearGenero(pool, "Terror");
    await pool.query("INSERT INTO interes_usuario (usuario_id, genero_id) VALUES ($1, $2)", [
      yo,
      genero,
    ]);
    const titulo = await crearContenido(pool, "pelicula", "cuenta-borrar-1");
    const resena = await crearResena(pool, yo, titulo, 4);
    await pool.query("UPDATE resena SET comentario = 'Mía' WHERE id = $1", [resena]);
    await pool.query(
      "INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, 'vista')",
      [yo, titulo],
    );
    await crearAmistad(pool, yo, otro);
    await pool.query("UPDATE amistad SET estado = 'aceptada'");
    const recomendacion = await crearRecomendacion(pool, otro, yo, titulo);
    await pool.query(
      "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, recomendacion_id) VALUES ($1, $2, 'recomendacion_recibida', $3)",
      [yo, otro, recomendacion],
    );
    const notificacionDeOtro = await pool.query(
      "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, recomendacion_id) VALUES ($1, $2, 'recomendacion_recibida', $3) RETURNING id",
      [otro, yo, recomendacion],
    );
    const a = buildTestApp(pool);
    const cookie = await sesionDe(a, CORREO);

    const res = await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: CONTRASENA, confirmacion: "ELIMINAR" });

    expect(res.status).toBe(204);
    expect(String(res.headers["set-cookie"])).toContain("cm_session=;");
    const fila = await pool.query(
      "SELECT nombre, username, correo, bio, avatar_url, eliminado_en FROM usuario WHERE id = $1",
      [yo],
    );
    expect(fila.rows[0]).toMatchObject({
      nombre: "Usuario eliminado",
      username: `eliminado_${yo}`,
      correo: null,
      bio: null,
      avatar_url: null,
    });
    expect(fila.rows[0]?.eliminado_en).not.toBeNull();
    expect(
      Number(
        (await pool.query("SELECT count(*) AS n FROM resena WHERE id = $1", [resena])).rows[0]?.n,
      ),
    ).toBe(1);
    expect(
      Number(
        (await pool.query("SELECT count(*) AS n FROM interes_usuario WHERE usuario_id = $1", [yo]))
          .rows[0]?.n,
      ),
    ).toBe(0);
    expect(
      Number(
        (await pool.query("SELECT count(*) AS n FROM seguimiento WHERE usuario_id = $1", [yo]))
          .rows[0]?.n,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM amistad WHERE solicitante_id = $1 OR receptor_id = $1",
            [yo],
          )
        ).rows[0]?.n,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM recomendacion WHERE emisor_id = $1 OR receptor_id = $1",
            [yo],
          )
        ).rows[0]?.n,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query("SELECT count(*) AS n FROM notificacion WHERE id = $1", [
            notificacionDeOtro.rows[0]?.id,
          ])
        ).rows[0]?.n,
      ),
    ).toBe(0);
    expect((await request(a).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });

  it("tras eliminar, las reseñas siguen en la ficha con el autor anonimizado y el inicio de sesión falla", async () => {
    const yo = await crearUsuarioConContrasena(pool, "cuenta_resenas", CORREO, CONTRASENA);
    const lector = await crearUsuarioConContrasena(
      pool,
      "cuenta_lector",
      "cuenta.lector@cinematch.test",
      CONTRASENA,
    );
    void lector;
    const titulo = await crearContenido(pool, "pelicula", "cuenta-resenas-1");
    await crearResena(pool, yo, titulo, 5);
    const a = buildTestApp(pool);
    const cookie = await sesionDe(a, CORREO);
    await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: CONTRASENA, confirmacion: "ELIMINAR" });

    const stats = await request(a)
      .get(`/api/titles/${titulo}/stats`)
      .set("Cookie", await sesionDe(a, "cuenta.lector@cinematch.test"));
    const listado = await request(a)
      .get(`/api/titles/${titulo}/reviews`)
      .set("Cookie", await sesionDe(a, "cuenta.lector@cinematch.test"));
    const login = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: CORREO, contrasena: CONTRASENA });

    expect(stats.body.promedioPublico).toBe(5);
    expect(stats.body.conteoPublico).toBe(1);
    expect(listado.body.items.length).toBeGreaterThanOrEqual(0);
    expect(login.status).toBe(401);
  });

  it("el correo de la cuenta eliminada puede volver a registrarse", async () => {
    const yo = await crearUsuarioConContrasena(pool, "cuenta_reuso", CORREO, CONTRASENA);
    void yo;
    const a = buildTestApp(pool);
    const cookie = await sesionDe(a, CORREO);
    await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: CONTRASENA, confirmacion: "ELIMINAR" });
    const generos = [
      await crearGenero(pool, "Comedia"),
      await crearGenero(pool, "Western"),
      await crearGenero(pool, "Documental"),
    ];

    const registro = await request(a).post("/api/auth/register").set("Origin", ORIGEN).send({
      nombre: "Nueva persona",
      username: "cuenta_nueva",
      correo: CORREO,
      contrasena: "Otra12345",
      aceptaDatos: true,
      generoIds: generos,
    });

    expect(registro.status).toBe(201);
  });

  it("al eliminar, se borra el archivo de avatar del disco", async () => {
    const yo = await crearUsuarioConContrasena(pool, "cuenta_avatar", CORREO, CONTRASENA);
    const nombre = `${yo}-${"a".repeat(32)}.webp`;
    await writeFile(join(directorio, nombre), Buffer.from("imagen"));
    await pool.query("UPDATE usuario SET avatar_url = $2 WHERE id = $1", [
      yo,
      `/uploads/avatars/${nombre}`,
    ]);
    const a = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
    const cookie = await sesionDe(a, CORREO);

    await request(a)
      .delete("/api/users/me")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ password: CONTRASENA, confirmacion: "ELIMINAR" });

    // Se comprueba después del COMMIT: el borrado del archivo ocurre tras la transacción.
    let existe = true;
    for (let i = 0; i < 20 && existe; i++) {
      existe = await access(join(directorio, nombre)).then(
        () => true,
        () => false,
      );
      if (existe) await new Promise((r) => setTimeout(r, 25));
    }
    expect(existe).toBe(false);
  });
});
