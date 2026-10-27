import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearAmistad, crearUsuario, crearUsuarioConContrasena } from "../helpers/fixtures.js";
import { withTransaction } from "../../src/lib/db.js";
import { crearServicioCreacion } from "../../src/modules/notificaciones/notificaciones.creacion.js";
import {
  crearHubNotificaciones,
  type HubNotificaciones,
  type IntervalosStream,
} from "../../src/modules/notificaciones/notificaciones.stream.js";

const ORIGEN = "http://localhost:3000";
const CONTRASENA = "Clave1234";
const LATIDO_LEJANO = 60_000;

type Stream = {
  status: number;
  headers: Headers;
  leerHasta(texto: string, ms?: number): Promise<string>;
  esperarCierre(ms?: number): Promise<void>;
  texto(): string;
  cerrar(): void;
};

// Espera `promesa` como mucho `ms` milisegundos y limpia el temporizador.
function conTiempo<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

// Abre el stream con fetch (supertest no sirve: una respuesta SSE no termina nunca).
async function abrirStream(
  base: string,
  cookie: string,
  extra: Record<string, string> = {},
): Promise<Stream> {
  const controlador = new AbortController();
  const res = await fetch(`${base}/api/notifications/stream`, {
    headers: { Cookie: cookie, ...extra },
    signal: controlador.signal,
  });
  const lector = res.body?.getReader();
  if (!lector) {
    throw new Error("La respuesta no tiene cuerpo");
  }
  const decodificador = new TextDecoder();
  let acumulado = "";
  let terminado = false;

  // Lee un trozo del stream; devuelve false cuando el servidor cierra la conexión.
  async function leerTrozo(ms: number): Promise<boolean> {
    const { value, done } = await conTiempo(lector!.read(), ms, "Tiempo agotado leyendo el stream");
    if (done) {
      terminado = true;
      return false;
    }
    acumulado += decodificador.decode(value, { stream: true });
    return true;
  }

  return {
    status: res.status,
    headers: res.headers,
    texto: () => acumulado,
    async leerHasta(texto, ms = 5_000) {
      const limite = Date.now() + ms;
      while (!acumulado.includes(texto)) {
        if (terminado) {
          throw new Error(`El stream terminó antes de recibir: ${texto}`);
        }
        const restante = limite - Date.now();
        if (restante <= 0) {
          throw new Error(`No llegó a tiempo: ${texto}\nRecibido:\n${acumulado}`);
        }
        await leerTrozo(restante);
      }
      return acumulado;
    },
    async esperarCierre(ms = 5_000) {
      const limite = Date.now() + ms;
      while (!terminado) {
        const restante = limite - Date.now();
        if (restante <= 0) {
          throw new Error("El stream no se cerró a tiempo");
        }
        await leerTrozo(restante);
      }
    },
    cerrar() {
      controlador.abort();
    },
  };
}

describe("stream SSE de notificaciones (BE-5.3)", () => {
  let pool: pg.Pool;
  let servidores: Server[] = [];
  let streams: Stream[] = [];
  let contador = 0;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterEach(async () => {
    for (const stream of streams) stream.cerrar();
    streams = [];
    for (const servidor of servidores) {
      servidor.closeAllConnections();
      await new Promise<void>((resolver) => servidor.close(() => resolver()));
    }
    servidores = [];
  });

  // Levanta la app en un puerto real para poder leer el stream.
  async function levantar(
    intervalosStream: Partial<IntervalosStream> = {},
    hub: HubNotificaciones = crearHubNotificaciones(),
  ) {
    const app = buildTestApp(pool, undefined, false, {
      notificaciones: hub,
      intervalosStream: { latidoMs: LATIDO_LEJANO, sesionMs: LATIDO_LEJANO, ...intervalosStream },
    });
    const servidor = app.listen(0, "127.0.0.1");
    await once(servidor, "listening");
    servidores.push(servidor);
    const { port } = servidor.address() as AddressInfo;
    return { app, hub, base: `http://127.0.0.1:${port}` };
  }

  async function iniciarSesion(
    app: ReturnType<typeof buildTestApp>,
    correo: string,
  ): Promise<string> {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGEN)
      .send({ correo, contrasena: CONTRASENA });
    return String(res.headers["set-cookie"]).split(";")[0] ?? "";
  }

  // Crea una notificación de amistad para `destino` a través del servicio real (con afterCommit).
  async function notificar(hub: HubNotificaciones, destino: number): Promise<number> {
    contador += 1;
    const origen = await crearUsuario(pool, `origen_sse_${contador}`);
    const amistad = await crearAmistad(pool, origen, destino);
    const servicio = crearServicioCreacion({ emisor: hub });
    const creada = await withTransaction(pool, (tx) =>
      servicio.crear(tx, {
        tipo: "solicitud_amistad",
        destinatarioId: destino,
        origenId: origen,
        referencia: { amistadId: amistad },
      }),
    );
    return creada.id;
  }

  async function usuario(nombre: string, correo: string): Promise<number> {
    return crearUsuarioConContrasena(pool, nombre, correo, CONTRASENA);
  }

  it("exige sesión (401 sin cookie)", async () => {
    const app = buildTestApp(pool);

    const res = await request(app).get("/api/notifications/stream");

    expect(res.status).toBe(401);
  });

  it("abre un stream SSE con sus cabeceras, retry y evento ready", async () => {
    await usuario("sse_cabeceras", "sse.cabeceras@cinematch.test");
    const { app, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.cabeceras@cinematch.test");

    const stream = await abrirStream(base, cookie);
    streams.push(stream);
    await stream.leerHasta("event: ready");

    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    expect(stream.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(stream.headers.get("x-accel-buffering")).toBe("no");
    expect(stream.texto()).toContain("retry: 3000");
  });

  it("entrega una notificación nueva a la pestaña del destinatario en ≤5 s", async () => {
    const destino = await usuario("sse_vivo", "sse.vivo@cinematch.test");
    const { app, hub, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.vivo@cinematch.test");
    const stream = await abrirStream(base, cookie);
    streams.push(stream);
    await stream.leerHasta("event: ready");

    const id = await notificar(hub, destino);

    await stream.leerHasta(`id: ${id}\nevent: notification`);
    expect(stream.texto()).toContain(`"tipo":"solicitud_amistad"`);
  });

  it("nunca envía a un usuario los eventos de otro", async () => {
    const ana = await usuario("sse_ana", "sse.ana@cinematch.test");
    const luis = await usuario("sse_luis", "sse.luis@cinematch.test");
    const { app, hub, base } = await levantar();
    const cookieAna = await iniciarSesion(app, "sse.ana@cinematch.test");
    const cookieLuis = await iniciarSesion(app, "sse.luis@cinematch.test");
    const streamAna = await abrirStream(base, cookieAna);
    const streamLuis = await abrirStream(base, cookieLuis);
    streams.push(streamAna, streamLuis);
    await streamAna.leerHasta("event: ready");
    await streamLuis.leerHasta("event: ready");

    const idLuis = await notificar(hub, luis);
    const idAna = await notificar(hub, ana);

    await streamAna.leerHasta(`id: ${idAna}\nevent: notification`);
    await streamLuis.leerHasta(`id: ${idLuis}\nevent: notification`);
    expect(streamAna.texto()).not.toContain(`id: ${idLuis}\n`);
  });

  it("entrega a todas las pestañas abiertas del mismo usuario", async () => {
    const destino = await usuario("sse_pestanas", "sse.pestanas@cinematch.test");
    const { app, hub, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.pestanas@cinematch.test");
    const primera = await abrirStream(base, cookie);
    const segunda = await abrirStream(base, cookie);
    streams.push(primera, segunda);
    await primera.leerHasta("event: ready");
    await segunda.leerHasta("event: ready");

    const id = await notificar(hub, destino);

    await primera.leerHasta(`id: ${id}\nevent: notification`);
    await segunda.leerHasta(`id: ${id}\nevent: notification`);
  });

  it("tras cortar la conexión, al reconectar con Last-Event-ID recibe lo perdido sin repetir", async () => {
    const destino = await usuario("sse_reconecta", "sse.reconecta@cinematch.test");
    const { app, hub, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.reconecta@cinematch.test");
    const primera = await abrirStream(base, cookie);
    streams.push(primera);
    await primera.leerHasta("event: ready");
    const idPrimera = await notificar(hub, destino);
    await primera.leerHasta(`id: ${idPrimera}\nevent: notification`);
    primera.cerrar();

    // Mientras no hay conexión, la notificación se guarda igualmente.
    const idPerdida = await notificar(hub, destino);

    const segunda = await abrirStream(base, cookie, { "Last-Event-ID": String(idPrimera) });
    streams.push(segunda);
    await segunda.leerHasta(`id: ${idPerdida}\nevent: notification`);
    expect(segunda.texto()).not.toContain(`id: ${idPrimera}\nevent: notification`);
    expect(segunda.texto().split(`id: ${idPerdida}\nevent: notification`)).toHaveLength(2);
  });

  it("como máximo 5 conexiones por usuario: la sexta responde 429", async () => {
    await usuario("sse_limite", "sse.limite@cinematch.test");
    const { app, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.limite@cinematch.test");
    for (let i = 0; i < 5; i++) {
      const stream = await abrirStream(base, cookie);
      streams.push(stream);
      await stream.leerHasta("event: ready");
    }

    const sexta = await fetch(`${base}/api/notifications/stream`, { headers: { Cookie: cookie } });

    expect(sexta.status).toBe(429);
    const cuerpo = (await sexta.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("al cerrar sesión, el stream de esa sesión se cierra", async () => {
    await usuario("sse_logout", "sse.logout@cinematch.test");
    const { app, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.logout@cinematch.test");
    const stream = await abrirStream(base, cookie);
    streams.push(stream);
    await stream.leerHasta("event: ready");

    const salida = await request(app)
      .post("/api/auth/logout")
      .set("Origin", ORIGEN)
      .set("Cookie", cookie);

    expect(salida.status).toBe(204);
    await stream.esperarCierre();
  });

  it("si la sesión deja de ser válida, el stream se cierra en la siguiente comprobación", async () => {
    await usuario("sse_revocada", "sse.revocada@cinematch.test");
    const { app, base } = await levantar({ sesionMs: 50 });
    const cookie = await iniciarSesion(app, "sse.revocada@cinematch.test");
    const stream = await abrirStream(base, cookie);
    streams.push(stream);
    await stream.leerHasta("event: ready");

    await pool.query("DELETE FROM sesion");

    await stream.esperarCierre();
  });

  it("envía latidos `: ping` para mantener viva la conexión", async () => {
    await usuario("sse_latido", "sse.latido@cinematch.test");
    const { app, base } = await levantar({ latidoMs: 20 });
    const cookie = await iniciarSesion(app, "sse.latido@cinematch.test");
    const stream = await abrirStream(base, cookie);
    streams.push(stream);

    await stream.leerHasta(": ping");
  });

  it("una notificación de una transacción revertida no se emite", async () => {
    const destino = await usuario("sse_revertida", "sse.revertida@cinematch.test");
    const { app, hub, base } = await levantar();
    const cookie = await iniciarSesion(app, "sse.revertida@cinematch.test");
    const stream = await abrirStream(base, cookie);
    streams.push(stream);
    await stream.leerHasta("event: ready");
    const origen = await crearUsuario(pool, "origen_revertida");
    const amistad = await crearAmistad(pool, origen, destino);
    const servicio = crearServicioCreacion({ emisor: hub });

    await expect(
      withTransaction(pool, async (tx) => {
        await servicio.crear(tx, {
          tipo: "solicitud_amistad",
          destinatarioId: destino,
          origenId: origen,
          referencia: { amistadId: amistad },
        });
        throw new Error("revierte");
      }),
    ).rejects.toThrow("revierte");
    const idConfirmada = await notificar(hub, destino);

    await stream.leerHasta(`id: ${idConfirmada}\nevent: notification`);
    expect(stream.texto().split("event: notification")).toHaveLength(2);
  });
});
