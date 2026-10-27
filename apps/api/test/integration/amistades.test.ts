import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearContenido, crearResena, crearUsuarioConContrasena } from "../helpers/fixtures.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("amistades (BE-7.1, BE-7.2 y BE-7.4)", () => {
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

  // Usuario con contraseña y su sesión, para actuar como esa persona.
  async function persona(nombre: string) {
    const id = await crearUsuarioConContrasena(
      pool,
      nombre,
      `${nombre}@cinematch.test`,
      CONTRASENA,
    );
    return { id, nombre };
  }

  function app() {
    return buildTestApp(pool);
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>, nombre: string): Promise<string> {
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: `${nombre}@cinematch.test`, contrasena: CONTRASENA });
    return cookieDe(res);
  }

  async function solicitar(a: ReturnType<typeof buildTestApp>, cookie: string, usuarioId: number) {
    return request(a)
      .post("/api/friends/requests")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie)
      .send({ usuarioId });
  }

  async function notificacionesDe(usuarioId: number): Promise<string[]> {
    const { rows } = await pool.query<{ tipo: string }>(
      "SELECT tipo FROM notificacion WHERE usuario_destinatario_id = $1 ORDER BY id",
      [usuarioId],
    );
    return rows.map((fila) => fila.tipo);
  }

  it("exige sesión para enviar una solicitud", async () => {
    const otro = await persona("sin_sesion_otro");

    const res = await request(app())
      .post("/api/friends/requests")
      .set("Origin", ORIGEN)
      .send({ usuarioId: otro.id });

    expect(res.status).toBe(401);
  });

  describe("enviar solicitud (BE-7.1)", () => {
    it("crea una solicitud pendiente y una notificación en la misma transacción", async () => {
      const ana = await persona("ana_amigos");
      const luis = await persona("luis_amigos");
      const a = app();
      const cookie = await sesionDe(a, ana.nombre);

      const res = await solicitar(a, cookie, luis.id);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        estado: "pendiente",
        solicitanteId: ana.id,
        receptorId: luis.id,
      });
      expect(await notificacionesDe(luis.id)).toEqual(["solicitud_amistad"]);
    });

    it("rechaza enviarse una solicitud a uno mismo", async () => {
      const ana = await persona("ana_yo");
      const a = app();
      const cookie = await sesionDe(a, ana.nombre);

      const res = await solicitar(a, cookie, ana.id);

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("usuarioId");
    });

    it("rechaza un usuario inexistente o eliminado con 404", async () => {
      const ana = await persona("ana_inexistente");
      const borrado = await persona("borrado_amigo");
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [borrado.id]);
      const a = app();
      const cookie = await sesionDe(a, ana.nombre);

      expect((await solicitar(a, cookie, 999_999)).status).toBe(404);
      expect((await solicitar(a, cookie, borrado.id)).status).toBe(404);
    });

    it("una solicitud repetida en la misma dirección devuelve 409 claro", async () => {
      const ana = await persona("ana_repite");
      const luis = await persona("luis_repite");
      const a = app();
      const cookie = await sesionDe(a, ana.nombre);
      await solicitar(a, cookie, luis.id);

      const res = await solicitar(a, cookie, luis.id);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain("Ya enviaste");
    });

    it("si la otra persona ya te envió una pendiente, pedirle otra devuelve 409 que sugiere aceptarla", async () => {
      const ana = await persona("ana_inversa");
      const luis = await persona("luis_inversa");
      const a = app();
      await solicitar(a, await sesionDe(a, luis.nombre), ana.id);

      const res = await solicitar(a, await sesionDe(a, ana.nombre), luis.id);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain("acéptala");
    });

    it("ya siendo amigos, enviar otra solicitud devuelve 409", async () => {
      const ana = await persona("ana_ya_amigos");
      const luis = await persona("luis_ya_amigos");
      const a = app();
      const cookieAna = await sesionDe(a, ana.nombre);
      const enviada = await solicitar(a, cookieAna, luis.id);
      await request(a)
        .post(`/api/friends/requests/${enviada.body.id}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));

      const res = await solicitar(a, cookieAna, luis.id);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain("amigos");
    });

    it("reenviar una solicitud rechazada la vuelve a dejar pendiente con la fecha actualizada", async () => {
      const ana = await persona("ana_reenvia");
      const luis = await persona("luis_reenvia");
      const a = app();
      const cookieAna = await sesionDe(a, ana.nombre);
      const original = await solicitar(a, cookieAna, luis.id);
      await request(a)
        .post(`/api/friends/requests/${original.body.id}/reject`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));
      await pool.query(
        "UPDATE amistad SET fecha_solicitud = '2000-01-01T00:00:00Z' WHERE id = $1",
        [original.body.id],
      );

      const reenvio = await solicitar(a, cookieAna, luis.id);

      expect(reenvio.status).toBe(201);
      expect(reenvio.body).toMatchObject({
        id: original.body.id,
        estado: "pendiente",
        fechaRespuesta: null,
      });
      expect(new Date(reenvio.body.fechaSolicitud).getFullYear()).toBeGreaterThan(2000);
    });
  });

  describe("responder, cancelar y eliminar (BE-7.2)", () => {
    async function pendiente() {
      const ana = await persona("ana_resp");
      const luis = await persona("luis_resp");
      const a = app();
      const enviada = await solicitar(a, await sesionDe(a, ana.nombre), luis.id);
      return { a, ana, luis, id: enviada.body.id as number };
    }

    it("solo el receptor puede aceptar; el solicitante recibe amistad_aceptada", async () => {
      const { a, ana, luis, id } = await pendiente();

      const delSolicitante = await request(a)
        .post(`/api/friends/requests/${id}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, ana.nombre));
      const delReceptor = await request(a)
        .post(`/api/friends/requests/${id}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));

      expect(delSolicitante.status).toBe(403);
      expect(delReceptor.status).toBe(200);
      expect(delReceptor.body.estado).toBe("aceptada");
      expect(await notificacionesDe(ana.id)).toEqual(["amistad_aceptada"]);
    });

    it("solo el receptor puede rechazar, y una respuesta ya dada no se repite", async () => {
      const { a, ana, luis, id } = await pendiente();

      const delSolicitante = await request(a)
        .post(`/api/friends/requests/${id}/reject`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, ana.nombre));
      const delReceptor = await request(a)
        .post(`/api/friends/requests/${id}/reject`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));
      const repetido = await request(a)
        .post(`/api/friends/requests/${id}/reject`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));

      expect(delSolicitante.status).toBe(403);
      expect(delReceptor.body.estado).toBe("rechazada");
      expect(repetido.status).toBe(409);
    });

    it("solo el solicitante puede cancelar una pendiente, y la fila desaparece", async () => {
      const { a, ana, luis, id } = await pendiente();

      const delReceptor = await request(a)
        .delete(`/api/friends/requests/${id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));
      const delSolicitante = await request(a)
        .delete(`/api/friends/requests/${id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, ana.nombre));

      expect(delReceptor.status).toBe(403);
      expect(delSolicitante.status).toBe(204);
      const { rows } = await pool.query("SELECT 1 FROM amistad WHERE id = $1", [id]);
      expect(rows).toHaveLength(0);
    });

    it("cualquiera de las dos partes puede eliminar una amistad aceptada, y las reseñas se conservan", async () => {
      const { a, ana, luis, id } = await pendiente();
      await request(a)
        .post(`/api/friends/requests/${id}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));
      const contenido = await crearContenido(pool, "pelicula", "amigos-1");
      const resena = await crearResena(pool, ana.id, contenido);

      const eliminar = await request(a)
        .delete(`/api/friends/${id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, luis.nombre));

      expect(eliminar.status).toBe(204);
      const { rows } = await pool.query("SELECT 1 FROM resena WHERE id = $1", [resena]);
      expect(rows).toHaveLength(1);
    });

    it("no se puede eliminar una solicitud pendiente como si fuera amistad", async () => {
      const { a, ana, id } = await pendiente();

      const res = await request(a)
        .delete(`/api/friends/${id}`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, ana.nombre));

      expect(res.status).toBe(409);
    });

    it("una persona ajena a la solicitud no la ve: 404", async () => {
      const { a, id } = await pendiente();
      const ajena = await persona("ajena_resp");

      const res = await request(a)
        .post(`/api/friends/requests/${id}/accept`)
        .set("Origin", ORIGEN)
        .set("Cookie", await sesionDe(a, ajena.nombre));

      expect(res.status).toBe(404);
    });
  });

  describe("concurrencia (BE-7.4)", () => {
    it("dos solicitudes simultáneas A→B y B→A dejan una sola fila y la segunda recibe 409", async () => {
      const ana = await persona("ana_carrera");
      const luis = await persona("luis_carrera");
      const a = app();
      const cookieAna = await sesionDe(a, ana.nombre);
      const cookieLuis = await sesionDe(a, luis.nombre);

      const [primera, segunda] = await Promise.all([
        solicitar(a, cookieAna, luis.id),
        solicitar(a, cookieLuis, ana.id),
      ]);

      const codigos = [primera.status, segunda.status].sort();
      expect(codigos).toEqual([201, 409]);
      const { rows } = await pool.query("SELECT count(*) AS total FROM amistad");
      expect(Number(rows[0]?.total)).toBe(1);
    });
  });
});
