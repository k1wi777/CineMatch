import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import {
  crearAmistad,
  crearContenido,
  crearRecomendacion,
  crearResena,
  crearUsuario,
  crearUsuarioConContrasena,
} from "../helpers/fixtures.js";
import { crearMockProvider } from "../../src/modules/catalogo/proveedor/mock-provider.js";
import { EventBus } from "../../src/lib/events.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

describe("administración: sincronización, moderación y auditoría (BE-12)", () => {
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

  // Usuario con rol administrador y su sesión.
  async function administrador(
    a: ReturnType<typeof buildTestApp>,
    nombre: string,
  ): Promise<{ id: number; cookie: string }> {
    const id = await crearUsuarioConContrasena(
      pool,
      nombre,
      `${nombre}@cinematch.test`,
      CONTRASENA,
    );
    await pool.query(
      "INSERT INTO rol (nombre) VALUES ('administrador') ON CONFLICT (nombre) DO NOTHING",
    );
    await pool.query(
      "UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = 'administrador') WHERE id = $1",
      [id],
    );
    const res = await request(a)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo: `${nombre}@cinematch.test`, contrasena: CONTRASENA });
    return { id, cookie: cookieDe(res) };
  }

  async function sesionDe(a: ReturnType<typeof buildTestApp>, correo: string): Promise<string> {
    return cookieDe(
      await request(a)
        .post("/api/auth/login")
        .set("Origin", ORIGEN)
        .send({ correo, contrasena: CONTRASENA }),
    );
  }

  // Reseña de un autor nuevo sobre un título, con visibilidad y etiquetas opcionales.
  async function resena(
    contenido: number,
    visibilidad: "publica" | "amigos" = "publica",
    comentario = "comentario",
  ): Promise<{ id: number; autor: number }> {
    const autor = await crearUsuario(pool, `ad_autor_${Math.random().toString(36).slice(2, 8)}`);
    const id = await crearResena(pool, autor, contenido, 4);
    await pool.query("UPDATE resena SET comentario = $2, visibilidad = $3 WHERE id = $1", [
      id,
      comentario,
      visibilidad,
    ]);
    return { id, autor };
  }

  describe("permisos", () => {
    it("sin sesión responde 401 y un usuario normal 403", async () => {
      const a = buildTestApp(pool);
      await crearUsuarioConContrasena(pool, "ad_normal", "ad.normal@cinematch.test", CONTRASENA);
      const cookie = await sesionDe(a, "ad.normal@cinematch.test");

      const anonimo = await request(a).get("/api/admin/reviews");
      const normal = await request(a).get("/api/admin/reviews").set("Cookie", cookie);

      expect(anonimo.status).toBe(401);
      expect(normal.status).toBe(403);
    });
  });

  describe("sincronización manual (BE-12.1)", () => {
    it("responde 202 enseguida, rechaza una segunda en curso con 409 y deja el resumen consultable", async () => {
      const lenta = {
        ...crearMockProvider(),
        async fetchPopular(tipo: "pelicula" | "serie", pagina: number) {
          await new Promise((r) => setTimeout(r, 50));
          return crearMockProvider().fetchPopular(tipo, pagina);
        },
      };
      const a = buildTestApp(pool, undefined, false, {
        proveedorCatalogo: lenta,
        cantidadSincronizacion: 2,
      });
      const admin = await administrador(a, "ad_sync");

      const inicio = await request(a)
        .post("/api/admin/catalog/sync")
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      const enCurso = await request(a)
        .post("/api/admin/catalog/sync")
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);

      expect(inicio.status).toBe(202);
      expect(inicio.body.estado).toBe("en_curso");
      expect(enCurso.status).toBe(409);

      let estado = await request(a)
        .get("/api/admin/catalog/sync/status")
        .set("Cookie", admin.cookie);
      for (let i = 0; i < 100 && estado.body.estado === "en_curso"; i++) {
        await new Promise((r) => setTimeout(r, 100));
        estado = await request(a).get("/api/admin/catalog/sync/status").set("Cookie", admin.cookie);
      }
      expect(estado.body.estado).toBe("ok");
      expect(estado.body.ultimoResumen).toMatchObject({ agregados: 4 });
    });

    it("solo el administrador puede lanzarla", async () => {
      const a = buildTestApp(pool);
      await crearUsuarioConContrasena(
        pool,
        "ad_sync_normal",
        "ad.sync.normal@cinematch.test",
        CONTRASENA,
      );
      const cookie = await sesionDe(a, "ad.sync.normal@cinematch.test");

      const res = await request(a)
        .post("/api/admin/catalog/sync")
        .set("Origin", ORIGEN)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
    });
  });

  describe("moderación (BE-12.2)", () => {
    it("el administrador ve todas las visibilidades y puede filtrar por estado, título y texto", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_lista");
      const titulo = await crearContenido(pool, "pelicula", "mod-1");
      const otro = await crearContenido(pool, "pelicula", "mod-2");
      await resena(titulo, "publica", "buena");
      await resena(titulo, "amigos", "solo amigos");
      const oculta = await resena(otro, "publica", "mala");
      await pool.query("UPDATE resena SET visible = false WHERE id = $1", [oculta.id]);

      const todas = await request(a).get("/api/admin/reviews").set("Cookie", admin.cookie);
      const ocultas = await request(a)
        .get("/api/admin/reviews?estado=oculta")
        .set("Cookie", admin.cookie);
      const porTitulo = await request(a)
        .get(`/api/admin/reviews?contentId=${titulo}`)
        .set("Cookie", admin.cookie);
      const porTexto = await request(a)
        .get("/api/admin/reviews?q=amigos")
        .set("Cookie", admin.cookie);

      expect(todas.body.total).toBe(3);
      expect(todas.body.items.map((i: { visibilidad: string }) => i.visibilidad)).toContain(
        "amigos",
      );
      expect(ocultas.body.items.map((i: { id: number }) => i.id)).toEqual([oculta.id]);
      expect(porTitulo.body.total).toBe(2);
      expect(porTexto.body.items).toHaveLength(1);
    });

    it("está paginado", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_pagina");
      const titulo = await crearContenido(pool, "pelicula", "mod-3");
      for (let i = 0; i < 3; i++) await resena(titulo);

      const res = await request(a)
        .get("/api/admin/reviews?pageSize=2&page=2")
        .set("Cookie", admin.cookie);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(3);
    });
  });

  describe("ocultar y restablecer (BE-12.3 y BE-12.4)", () => {
    it("ocultar excluye de agregados, notifica al autor una sola vez y es idempotente", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_oculta");
      const titulo = await crearContenido(pool, "pelicula", "oc-1");
      const lectora = await crearUsuarioConContrasena(
        pool,
        "ad_lectora",
        "ad.lectora@cinematch.test",
        CONTRASENA,
      );
      void lectora;
      const cookieLectora = await sesionDe(a, "ad.lectora@cinematch.test");
      const r = await resena(titulo);

      const antes = await request(a)
        .get(`/api/titles/${titulo}/stats`)
        .set("Cookie", cookieLectora);
      await request(a)
        .post(`/api/admin/reviews/${r.id}/hide`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      const segunda = await request(a)
        .post(`/api/admin/reviews/${r.id}/hide`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      const despues = await request(a)
        .get(`/api/titles/${titulo}/stats`)
        .set("Cookie", cookieLectora);
      const notificaciones = await pool.query(
        "SELECT tipo FROM notificacion WHERE usuario_destinatario_id = $1 AND tipo = 'resena_oculta'",
        [r.autor],
      );
      const auditoria = await pool.query(
        "SELECT count(*) AS total FROM auditoria_admin WHERE accion = 'ocultar_resena'",
      );

      expect(segunda.status).toBe(200);
      expect(antes.body.conteoPublico).toBe(1);
      expect(despues.body.conteoPublico).toBe(0);
      expect(notificaciones.rows).toHaveLength(1);
      expect(Number(auditoria.rows[0]?.total)).toBe(1);
    });

    it("restablecer vuelve a mostrarla, no notifica y es idempotente", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_restaura");
      const titulo = await crearContenido(pool, "pelicula", "rs-1");
      const r = await resena(titulo);
      await request(a)
        .post(`/api/admin/reviews/${r.id}/hide`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);

      const res = await request(a)
        .post(`/api/admin/reviews/${r.id}/restore`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      await request(a)
        .post(`/api/admin/reviews/${r.id}/restore`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      const visible = await pool.query("SELECT visible FROM resena WHERE id = $1", [r.id]);
      const restauradas = await pool.query(
        "SELECT count(*) AS total FROM notificacion WHERE usuario_destinatario_id = $1 AND tipo = 'resena_oculta'",
        [r.autor],
      );

      expect(res.body).toEqual({ id: r.id, visible: true });
      expect(visible.rows[0]?.visible).toBe(true);
      expect(Number(restauradas.rows[0]?.total)).toBe(1);
    });

    it("emite review.hidden y review.restored", async () => {
      const eventos = new EventBus({ error: () => undefined });
      const emitidos: string[] = [];
      eventos.onInTransaction("review.hidden", async () => {
        emitidos.push("hidden");
      });
      eventos.onInTransaction("review.restored", async () => {
        emitidos.push("restored");
      });
      const a = buildTestApp(pool, undefined, false, { eventos });
      const admin = await administrador(a, "ad_evento");
      const titulo = await crearContenido(pool, "pelicula", "ev-1");
      const r = await resena(titulo);

      await request(a)
        .post(`/api/admin/reviews/${r.id}/hide`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      await request(a)
        .post(`/api/admin/reviews/${r.id}/restore`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);

      expect(emitidos).toEqual(["hidden", "restored"]);
    });

    it("una recomendación que adjuntaba la reseña muestra solo el motivo mientras está oculta", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_recom");
      const titulo = await crearContenido(pool, "pelicula", "rc-1");
      const r = await resena(titulo);
      const receptor = await crearUsuarioConContrasena(
        pool,
        "ad_receptor",
        "ad.receptor@cinematch.test",
        CONTRASENA,
      );
      const recomendacion = await crearRecomendacion(pool, r.autor, receptor, titulo);
      await pool.query(
        "UPDATE recomendacion SET resena_id = $1, motivo = 'Te gustará' WHERE id = $2",
        [r.id, recomendacion],
      );
      await crearAmistad(pool, r.autor, receptor);
      const cookieReceptor = await sesionDe(a, "ad.receptor@cinematch.test");

      await request(a)
        .post(`/api/admin/reviews/${r.id}/hide`)
        .set("Origin", ORIGEN)
        .set("Cookie", admin.cookie);
      const oculta = await request(a)
        .get(`/api/recommendations/${recomendacion}`)
        .set("Cookie", cookieReceptor);

      expect(oculta.body.resenaAdjunta).toBeNull();
      expect(oculta.body.motivo).toBe("Te gustará");
    });

    it("no hay endpoint de consulta de la auditoría", async () => {
      const a = buildTestApp(pool);
      const admin = await administrador(a, "ad_sin_audit");

      const res = await request(a).get("/api/admin/audit").set("Cookie", admin.cookie);

      expect(res.status).toBe(404);
    });
  });
});
