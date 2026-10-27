import type { Notificacion } from "@cinematch/shared";
import { Router, type Request, type Response } from "express";
import type pg from "pg";
import type { Logger } from "pino";
import { leerCookie } from "../../lib/cookies.js";
import { TooManyRequestsError, UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { trackSseConnection } from "../../lib/sse.js";
import { hashToken } from "../../lib/session-token.js";
import { requireAuth } from "../../middleware/auth.js";
import { NOMBRE_COOKIE_SESION } from "../auth/auth.routes.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { EmisorNotificaciones } from "./notificaciones.creacion.js";
import {
  aNotificacion,
  SELECT_NOTIFICACION,
  type FilaNotificacion,
} from "./notificaciones.repository.js";

export const MAX_CONEXIONES_POR_USUARIO = 5;
// Al reconectar con Last-Event-ID se reenvían como máximo estas notificaciones.
export const MAX_REENVIO_AL_RECONECTAR = 100;

export type IntervalosStream = {
  // Latido `: ping` para que el proxy y el navegador no den la conexión por muerta.
  latidoMs: number;
  // Cada cuánto se vuelve a validar la sesión de un stream abierto.
  sesionMs: number;
};

export const INTERVALOS_STREAM_POR_DEFECTO: IntervalosStream = {
  latidoMs: 25_000,
  sesionMs: 60_000,
};

// Una pestaña conectada. `ultimoId` evita repetir una notificación ya enviada (reenvío + vivo).
export type ConexionStream = {
  res: Response;
  usuarioId: number;
  sesionId: string;
  ultimoId: number;
  listo: boolean;
  pendientes: Notificacion[];
  cerrar: () => void;
};

// Hub en memoria de las conexiones SSE. Solo emite lo que ya está confirmado (el servicio de creación usa afterCommit).
export type HubNotificaciones = EmisorNotificaciones & {
  registrar(conexion: ConexionStream): boolean;
  quitar(conexion: ConexionStream): void;
  cerrarSesion(sesionId: string): void;
  cerrarUsuario(usuarioId: number): void;
};

function escribirNotificacion(res: Response, notificacion: Notificacion): void {
  res.write(
    `id: ${notificacion.id}\nevent: notification\ndata: ${JSON.stringify(notificacion)}\n\n`,
  );
}

function enviar(conexion: ConexionStream, notificacion: Notificacion): void {
  if (conexion.res.writableEnded || notificacion.id <= conexion.ultimoId) return;
  escribirNotificacion(conexion.res, notificacion);
  conexion.ultimoId = notificacion.id;
}

export function crearHubNotificaciones(): HubNotificaciones {
  const porUsuario = new Map<number, Set<ConexionStream>>();

  return {
    emitir(destinatarioId, notificacion) {
      for (const conexion of [...(porUsuario.get(destinatarioId) ?? [])]) {
        if (conexion.listo) {
          enviar(conexion, notificacion);
        } else {
          // Mientras se reenvía el historial, las nuevas se guardan y se envían al terminar.
          conexion.pendientes.push(notificacion);
        }
      }
    },

    registrar(conexion) {
      const conexiones = porUsuario.get(conexion.usuarioId) ?? new Set<ConexionStream>();
      if (conexiones.size >= MAX_CONEXIONES_POR_USUARIO) return false;
      conexiones.add(conexion);
      porUsuario.set(conexion.usuarioId, conexiones);
      return true;
    },

    quitar(conexion) {
      const conexiones = porUsuario.get(conexion.usuarioId);
      if (!conexiones) return;
      conexiones.delete(conexion);
      if (conexiones.size === 0) porUsuario.delete(conexion.usuarioId);
    },

    // Llamado al cerrar sesión: corta los streams de esa sesión (no los de otras pestañas o dispositivos).
    cerrarSesion(sesionId) {
      for (const conexiones of porUsuario.values()) {
        for (const conexion of [...conexiones]) {
          if (conexion.sesionId === sesionId) conexion.cerrar();
        }
      }
    },

    // Llamado al eliminar la cuenta (BE-13.1): corta todos los streams de ese usuario.
    cerrarUsuario(usuarioId) {
      for (const conexion of [...(porUsuario.get(usuarioId) ?? [])]) {
        conexion.cerrar();
      }
    },
  };
}

export type DependenciasStream = {
  hub: HubNotificaciones;
  pool: pg.Pool;
  servicioAuth: ServicioAuth;
  logger: Logger;
  intervalos: IntervalosStream;
};

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/notifications/stream",
  resumen: "Stream SSE de notificaciones en vivo (text/event-stream)",
  respuestas: {
    200: { descripcion: "Stream abierto. Eventos: ready, notification y comentarios de latido." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    429: {
      descripcion: "Ya hay 5 conexiones abiertas para este usuario.",
      esquema: "ErrorResponse",
    },
  },
});

// Parte el Last-Event-ID del navegador. Si no es un id válido, se empieza sin reenvío.
function leerUltimoIdRecibido(req: Request): number {
  const valor = Number(req.get("last-event-id"));
  return Number.isInteger(valor) && valor > 0 ? valor : 0;
}

export function createStreamNotificacionesRouter(deps: DependenciasStream): Router {
  const { hub, pool, servicioAuth, logger, intervalos } = deps;
  const router = Router();
  // La validación de la sesión se hace por nuestra cuenta cada minuto, sin renovar su actividad.
  const autenticado = requireAuth(servicioAuth, { tocarActividad: false });

  router.get("/notifications/stream", autenticado, async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const usuarioId = req.user.id;
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION) ?? "";

    const conexion: ConexionStream = {
      res,
      usuarioId,
      sesionId: hashToken(token),
      ultimoId: leerUltimoIdRecibido(req),
      listo: false,
      pendientes: [],
      cerrar: () => {
        res.end();
      },
    };
    if (!hub.registrar(conexion)) {
      throw new TooManyRequestsError(
        `Ya tienes ${MAX_CONEXIONES_POR_USUARIO} conexiones abiertas. Cierra alguna pestaña.`,
      );
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Evita que Nginx u otro proxy acumulen el stream antes de enviarlo.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    trackSseConnection(res);

    const latido = setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
    }, intervalos.latidoMs);

    const comprobarSesion = setInterval(() => {
      servicioAuth
        .resolverSesion(token, { tocar: false })
        .then((sesion) => {
          if (!sesion) conexion.cerrar();
        })
        .catch((err: unknown) => {
          logger.error({ err, usuarioId }, "No se pudo validar la sesión del stream");
          conexion.cerrar();
        });
    }, intervalos.sesionMs);

    let cerrada = false;
    const liberar = () => {
      if (cerrada) return;
      cerrada = true;
      clearInterval(latido);
      clearInterval(comprobarSesion);
      hub.quitar(conexion);
      if (!res.writableEnded) res.end();
    };
    conexion.cerrar = liberar;
    res.on("close", liberar);

    res.write("retry: 3000\n\n");
    res.write("event: ready\ndata: {}\n\n");

    try {
      // Reenvío del historial posterior al último id recibido (máximo 100).
      const { rows } = await pool.query<FilaNotificacion>(
        `${SELECT_NOTIFICACION}
          WHERE n.usuario_destinatario_id = $1 AND n.id > $2
          ORDER BY n.id ASC
          LIMIT $3`,
        [usuarioId, conexion.ultimoId, MAX_REENVIO_AL_RECONECTAR],
      );
      for (const fila of rows) {
        enviar(conexion, aNotificacion(fila));
      }

      // Lo que llegó durante el reenvío: se envía sin repetir lo ya enviado.
      for (const notificacion of conexion.pendientes.sort((a, b) => a.id - b.id)) {
        enviar(conexion, notificacion);
      }
      conexion.pendientes = [];
      conexion.listo = true;
    } catch (err: unknown) {
      logger.error({ err, usuarioId }, "Falló el reenvío de notificaciones del stream");
      liberar();
    }
  });

  return router;
}
