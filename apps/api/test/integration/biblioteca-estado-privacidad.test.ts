import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearContenido, crearUsuario, crearUsuarioConContrasena } from "../helpers/fixtures.js";
import { withTransaction } from "../../src/lib/db.js";
import { crearServicioEstadoInterno } from "../../src/modules/biblioteca/biblioteca.estado.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("servicio interno de estado y privacidad de la biblioteca (BE-8.3 y BE-8.4)", () => {
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

  async function titulo(): Promise<number> {
    return crearContenido(pool, "pelicula", `estado-${Math.random()}`);
  }

  async function estadoDe(
    usuario: number,
    contenido: number,
  ): Promise<{ estado: string; fecha: string } | undefined> {
    const { rows } = await pool.query<{ estado: string; fecha: Date }>(
      "SELECT estado, fecha_actualizacion AS fecha FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
      [usuario, contenido],
    );
    const fila = rows[0];
    return fila ? { estado: fila.estado, fecha: fila.fecha.toISOString() } : undefined;
  }

  // Aplica markAs dentro de su propia transacción, como lo haría un módulo llamador.
  async function marcar(
    usuario: number,
    contenido: number,
    estado: "pendiente" | "viendo" | "vista" | "abandonada",
  ) {
    const servicio = crearServicioEstadoInterno(pool);
    await withTransaction(pool, (tx) => servicio.markAs(tx, usuario, contenido, estado));
  }

  describe("markAs (BE-8.3)", () => {
    it("es idempotente: repetirlo no cambia la fecha", async () => {
      const usuario = await crearUsuario(pool, "estado_idem");
      const contenido = await titulo();
      await marcar(usuario, contenido, "vista");
      await pool.query("UPDATE seguimiento SET fecha_actualizacion = '2000-01-01T00:00:00Z'");

      await marcar(usuario, contenido, "vista");

      expect((await estadoDe(usuario, contenido))?.fecha).toBe("2000-01-01T00:00:00.000Z");
    });

    it("RN2: calificar (vista) pasa de pendiente a vista, pero si ya estaba vista no cambia nada", async () => {
      const usuario = await crearUsuario(pool, "estado_rn2");
      const contenido = await titulo();
      await marcar(usuario, contenido, "pendiente");

      await marcar(usuario, contenido, "vista");
      const primera = await estadoDe(usuario, contenido);
      await marcar(usuario, contenido, "vista");
      const segunda = await estadoDe(usuario, contenido);

      expect(primera?.estado).toBe("vista");
      expect(segunda).toEqual(primera);
    });

    it("aceptar una recomendación (pendiente) no degrada un estado existente", async () => {
      const usuario = await crearUsuario(pool, "estado_no_degrada");
      const viendo = await titulo();
      const terminada = await titulo();
      const nueva = await titulo();
      await marcar(usuario, viendo, "viendo");
      await marcar(usuario, terminada, "vista");

      await marcar(usuario, viendo, "pendiente");
      await marcar(usuario, terminada, "pendiente");
      await marcar(usuario, nueva, "pendiente");

      expect((await estadoDe(usuario, viendo))?.estado).toBe("viendo");
      expect((await estadoDe(usuario, terminada))?.estado).toBe("vista");
      expect((await estadoDe(usuario, nueva))?.estado).toBe("pendiente");
    });

    it("si la transacción del llamador revierte, el cambio desaparece", async () => {
      const usuario = await crearUsuario(pool, "estado_rollback");
      const contenido = await titulo();
      const servicio = crearServicioEstadoInterno(pool);

      await expect(
        withTransaction(pool, async (tx) => {
          await servicio.markAs(tx, usuario, contenido, "vista");
          throw new Error("la reseña falló");
        }),
      ).rejects.toThrow("la reseña falló");

      expect(await estadoDe(usuario, contenido)).toBeUndefined();
    });

    it("hasSeen y getSeenFriendIds solo cuentan lo marcado como vista", async () => {
      const yo = await crearUsuario(pool, "estado_yo");
      const amigoVio = await crearUsuario(pool, "estado_amigo_vio");
      const amigoViendo = await crearUsuario(pool, "estado_amigo_viendo");
      const contenido = await titulo();
      await marcar(yo, contenido, "vista");
      await marcar(amigoVio, contenido, "vista");
      await marcar(amigoViendo, contenido, "viendo");
      const servicio = crearServicioEstadoInterno(pool);

      expect(await servicio.hasSeen(yo, contenido)).toBe(true);
      expect(await servicio.hasSeen(amigoViendo, contenido)).toBe(false);
      expect(await servicio.getSeenFriendIds([amigoVio, amigoViendo], contenido)).toEqual([
        amigoVio,
      ]);
      expect(await servicio.getSeenFriendIds([], contenido)).toEqual([]);
    });
  });

  describe("privacidad de la biblioteca (BE-8.4)", () => {
    const CORREO_AMIGA = "privacidad.amiga@cinematch.test";
    const CORREO_EXTRAÑA = "privacidad.extrana@cinematch.test";
    const CORREO_DUENO = "privacidad.dueno@cinematch.test";

    async function escenario() {
      const dueno = await crearUsuarioConContrasena(
        pool,
        "privacidad_dueno",
        CORREO_DUENO,
        CONTRASENA,
      );
      const amiga = await crearUsuarioConContrasena(
        pool,
        "privacidad_amiga",
        CORREO_AMIGA,
        CONTRASENA,
      );
      const extrana = await crearUsuarioConContrasena(
        pool,
        "privacidad_extrana",
        CORREO_EXTRAÑA,
        CONTRASENA,
      );
      await pool.query(
        "INSERT INTO amistad (solicitante_id, receptor_id, estado) VALUES ($1, $2, 'aceptada')",
        [dueno, amiga],
      );
      const contenido = await titulo();
      await marcar(dueno, contenido, "vista");
      const a = buildTestApp(pool);
      const sesion = async (correo: string) =>
        cookieDe(
          await request(a)
            .post("/api/auth/login")
            .set("Origin", ORIGEN)
            .send({ correo, contrasena: CONTRASENA }),
        );
      return { a, dueno, amiga, extrana, sesion };
    }

    it("el dueño y un amigo ven la biblioteca; un no amigo recibe 403", async () => {
      const { a, dueno, amiga, extrana, sesion } = await escenario();

      const delDueno = await request(a)
        .get(`/api/users/${dueno}/library`)
        .set("Cookie", await sesion(CORREO_DUENO));
      const delAmigo = await request(a)
        .get(`/api/users/${dueno}/library`)
        .set("Cookie", await sesion(CORREO_AMIGA));
      const delExtrano = await request(a)
        .get(`/api/users/${dueno}/library`)
        .set("Cookie", await sesion(CORREO_EXTRAÑA));

      expect(delDueno.status).toBe(200);
      expect(delAmigo.status).toBe(200);
      expect(delAmigo.body.total).toBe(1);
      expect(delExtrano.status).toBe(403);
      expect(amiga).not.toBe(extrana);
    });

    it("un usuario inexistente o eliminado devuelve 404 y sin sesión 401", async () => {
      const { a, dueno, sesion } = await escenario();
      const borrado = await crearUsuario(pool, "privacidad_borrado");
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [borrado]);
      const cookie = await sesion(CORREO_DUENO);

      const inexistente = await request(a).get("/api/users/999999/library").set("Cookie", cookie);
      const eliminado = await request(a).get(`/api/users/${borrado}/library`).set("Cookie", cookie);
      const anonimo = await request(a).get(`/api/users/${dueno}/library`);

      expect(inexistente.status).toBe(404);
      expect(eliminado.status).toBe(404);
      expect(anonimo.status).toBe(401);
    });

    it("al eliminar la amistad, el amigo deja de ver la biblioteca", async () => {
      const { a, dueno, amiga, sesion } = await escenario();
      await pool.query("DELETE FROM amistad WHERE solicitante_id = $1 AND receptor_id = $2", [
        dueno,
        amiga,
      ]);

      const res = await request(a)
        .get(`/api/users/${dueno}/library`)
        .set("Cookie", await sesion(CORREO_AMIGA));

      expect(res.status).toBe(403);
    });
  });
});
