import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";
import { crearServicioConsultaAmistades } from "../../src/modules/amistades/amistades.consulta.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("consultas de amistades y búsqueda de usuarios (BE-7.3 y BE-7.5)", () => {
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

  async function persona(nombre: string): Promise<number> {
    return crearUsuarioConContrasena(pool, nombre, `${nombre}@cinematch.test`, CONTRASENA);
  }

  // Crea la relación directamente: el flujo de envío ya está probado en amistades.test.ts.
  async function relacion(
    solicitante: number,
    receptor: number,
    estado: "pendiente" | "aceptada" | "rechazada",
  ) {
    await pool.query(
      "INSERT INTO amistad (solicitante_id, receptor_id, estado, fecha_respuesta) VALUES ($1, $2, $3::estado_amistad, CASE WHEN $3 = 'pendiente' THEN NULL ELSE now() END)",
      [solicitante, receptor, estado],
    );
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>, nombre: string): Promise<string> {
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: `${nombre}@cinematch.test`, contrasena: CONTRASENA });
    return cookieDe(res);
  }

  it("todas las listas y la búsqueda exigen sesión", async () => {
    const a = buildTestApp(pool);

    const respuestas = await Promise.all([
      request(a).get("/api/friends"),
      request(a).get("/api/friends/requests/received"),
      request(a).get("/api/friends/requests/sent"),
      request(a).get("/api/friends/requests/received/count"),
      request(a).get("/api/users?q=ana"),
    ]);

    expect(respuestas.every((res) => res.status === 401)).toBe(true);
  });

  describe("listas (BE-7.3)", () => {
    it("amigos: solo las aceptadas, con avatar y username; no las pendientes ni las rechazadas", async () => {
      const yo = await persona("yo_lista");
      const amiga = await persona("amiga_lista");
      const pendiente = await persona("pendiente_lista");
      const rechazado = await persona("rechazado_lista");
      await relacion(yo, amiga, "aceptada");
      await relacion(yo, pendiente, "pendiente");
      await relacion(rechazado, yo, "rechazada");
      await pool.query("UPDATE usuario SET avatar_url = '/uploads/avatars/a.webp' WHERE id = $1", [
        amiga,
      ]);
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/friends")
        .set("Cookie", await sesionDe(a, "yo_lista"));

      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({
        usuario: { id: amiga, username: "amiga_lista", avatarUrl: "/uploads/avatars/a.webp" },
      });
    });

    it("recibidas y enviadas: solo pendientes, en la dirección correcta", async () => {
      const yo = await persona("yo_dir");
      const quienMeEnvia = await persona("me_envia");
      const aQuienEnvio = await persona("a_quien_envio");
      await relacion(quienMeEnvia, yo, "pendiente");
      await relacion(yo, aQuienEnvio, "pendiente");
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a, "yo_dir");

      const recibidas = await request(a)
        .get("/api/friends/requests/received")
        .set("Cookie", cookie);
      const enviadas = await request(a).get("/api/friends/requests/sent").set("Cookie", cookie);

      expect(recibidas.body.items.map((i: { usuario: { id: number } }) => i.usuario.id)).toEqual([
        quienMeEnvia,
      ]);
      expect(enviadas.body.items.map((i: { usuario: { id: number } }) => i.usuario.id)).toEqual([
        aQuienEnvio,
      ]);
      expect(typeof recibidas.body.items[0].fechaSolicitud).toBe("string");
    });

    it("el contador cuenta solo las recibidas pendientes y baja al responder", async () => {
      const yo = await persona("yo_contador");
      const uno = await persona("uno_contador");
      const dos = await persona("dos_contador");
      await relacion(uno, yo, "pendiente");
      await relacion(dos, yo, "pendiente");
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a, "yo_contador");
      expect(
        (await request(a).get("/api/friends/requests/received/count").set("Cookie", cookie)).body
          .pendientes,
      ).toBe(2);

      await pool.query("UPDATE amistad SET estado = 'rechazada' WHERE solicitante_id = $1", [uno]);
      const despues = await request(a)
        .get("/api/friends/requests/received/count")
        .set("Cookie", cookie);

      expect(despues.body.pendientes).toBe(1);
    });

    it("las listas están paginadas", async () => {
      const yo = await persona("yo_pagina");
      for (let i = 1; i <= 3; i++) {
        await relacion(yo, await persona(`amiga_pagina_${i}`), "aceptada");
      }
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/friends?pageSize=2&page=2")
        .set("Cookie", await sesionDe(a, "yo_pagina"));

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(3);
    });
  });

  describe("utilidades internas", () => {
    it("sonAmigos e idsDeAmigos reflejan solo las amistades aceptadas, en ambos sentidos", async () => {
      const ana = await persona("ana_util");
      const luis = await persona("luis_util");
      const marta = await persona("marta_util");
      await relacion(luis, ana, "aceptada");
      await relacion(ana, marta, "pendiente");
      const servicio = crearServicioConsultaAmistades(pool);

      expect(await servicio.sonAmigos(ana, luis)).toBe(true);
      expect(await servicio.sonAmigos(luis, ana)).toBe(true);
      expect(await servicio.sonAmigos(ana, marta)).toBe(false);
      expect(await servicio.sonAmigos(ana, ana)).toBe(false);
      expect(await servicio.idsDeAmigos(ana)).toEqual([luis]);
    });
  });

  describe("búsqueda de usuarios (BE-7.5)", () => {
    it("busca por username parcial sin distinguir mayúsculas", async () => {
      await persona("Carlos_Busqueda");
      await persona("otro_nombre");
      await persona("carla_busqueda");
      await persona("yo_busca");
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/users?q=BUSQUEDA")
        .set("Cookie", await sesionDe(a, "yo_busca"));

      expect(res.body.items.map((i: { username: string }) => i.username).sort()).toEqual([
        "Carlos_Busqueda",
        "carla_busqueda",
      ]);
    });

    it("excluye a la propia sesión y a las cuentas eliminadas", async () => {
      await persona("yo_exclusion");
      await persona("visible_exclusion");
      const borrado = await persona("borrado_exclusion");
      await pool.query("UPDATE usuario SET eliminado_en = now() WHERE id = $1", [borrado]);
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/users?q=exclusion")
        .set("Cookie", await sesionDe(a, "yo_exclusion"));

      expect(res.body.items.map((i: { username: string }) => i.username)).toEqual([
        "visible_exclusion",
      ]);
    });

    it("el estado de relación es correcto para cada caso", async () => {
      const yo = await persona("yo_relacion");
      const ninguna = await persona("ninguna_relacion");
      const enviada = await persona("enviada_relacion");
      const recibida = await persona("recibida_relacion");
      const amiga = await persona("amiga_relacion");
      const rechazada = await persona("rechazada_relacion");
      await relacion(yo, enviada, "pendiente");
      await relacion(recibida, yo, "pendiente");
      await relacion(yo, amiga, "aceptada");
      await relacion(yo, rechazada, "rechazada");
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/users?q=relacion")
        .set("Cookie", await sesionDe(a, "yo_relacion"));

      const estados = Object.fromEntries(
        res.body.items.map((i: { id: number; relacion: string }) => [i.id, i.relacion]),
      );
      expect(estados[ninguna]).toBe("ninguna");
      expect(estados[enviada]).toBe("pendienteEnviada");
      expect(estados[recibida]).toBe("pendienteRecibida");
      expect(estados[amiga]).toBe("amigos");
      expect(estados[rechazada]).toBe("ninguna");
    });

    it("la búsqueda devuelve solo los campos acordados, sin correo ni contraseña", async () => {
      await persona("campos_busqueda");
      await persona("yo_campos");
      const a = buildTestApp(pool);

      const res = await request(a)
        .get("/api/users?q=campos")
        .set("Cookie", await sesionDe(a, "yo_campos"));

      expect(Object.keys(res.body.items[0]).sort()).toEqual(
        ["amistadId", "avatarUrl", "id", "nombre", "relacion", "username"].sort(),
      );
    });

    it("está paginada y una búsqueda vacía devuelve 422", async () => {
      for (let i = 1; i <= 3; i++) {
        await persona(`pagina_busqueda_${i}`);
      }
      await persona("yo_pagina_busqueda");
      const a = buildTestApp(pool);
      const cookie = await sesionDe(a, "yo_pagina_busqueda");

      const pagina = await request(a)
        .get("/api/users?q=pagina_busqueda&pageSize=2&page=2")
        .set("Cookie", cookie);
      const vacia = await request(a).get("/api/users?q=%20").set("Cookie", cookie);

      expect(pagina.body.items).toHaveLength(1);
      expect(pagina.body.total).toBe(3);
      expect(vacia.status).toBe(422);
    });
  });
});
