import type { RecommendationStatus } from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { ServicioCreacion } from "../notificaciones/notificaciones.creacion.js";
import type { ServicioEstadoInterno } from "../biblioteca/biblioteca.estado.js";
import { transition } from "./recommendation-state.js";

export type DependenciasAcciones = {
  pool: pg.Pool;
  creacion: ServicioCreacion;
  estado: ServicioEstadoInterno;
};

export type RespuestaAccion = { id: number; estado: RecommendationStatus };

// Aceptar y descartar (BE-10.5). Solo el receptor puede actuar; el emisor recibe 403 y quien no es parte, 404.
export function crearServicioAcciones({ pool, creacion, estado }: DependenciasAcciones) {
  // Carga la recomendación bloqueada y comprueba que la sesión es el receptor.
  async function cargarComoReceptor(
    tx: pg.PoolClient,
    id: number,
    yo: number,
  ): Promise<{ estado: RecommendationStatus; emisor_id: number; contenido_id: number }> {
    const { rows } = await tx.query<{
      estado: RecommendationStatus;
      emisor_id: number;
      receptor_id: number;
      contenido_id: number;
    }>(
      "SELECT estado, emisor_id, receptor_id, contenido_id FROM recomendacion WHERE id = $1 FOR UPDATE",
      [id],
    );
    const fila = rows[0];
    if (!fila || (fila.receptor_id !== yo && fila.emisor_id !== yo)) {
      throw new NotFoundError("La recomendación no existe.");
    }
    if (fila.receptor_id !== yo) {
      throw new ForbiddenError("Solo quien recibió la recomendación puede responderla.");
    }
    return fila;
  }

  return {
    // Aceptar: pasa a `aceptada`, deja el título en `pendiente` en la biblioteca (sin degradar) y avisa al emisor.
    // Si ya estaba aceptada, no se vuelve a notificar.
    async aceptar(yo: number, id: number): Promise<RespuestaAccion> {
      return withTransaction(pool, async (tx) => {
        const fila = await cargarComoReceptor(tx, id, yo);
        const { siguiente, cambia, campoFecha } = transition(fila.estado, "ACCEPT");
        if (cambia && campoFecha) {
          await tx.query(
            `UPDATE recomendacion SET estado = $2, ${campoFecha} = now() WHERE id = $1`,
            [id, siguiente],
          );
          await estado.markAs(tx, yo, fila.contenido_id, "pendiente");
          await creacion.crear(tx, {
            tipo: "recomendacion_aceptada",
            destinatarioId: fila.emisor_id,
            origenId: yo,
            referencia: { recomendacionId: id },
          });
        }
        return { id, estado: siguiente };
      });
    },

    // Descartar: pasa a `descartada` sin notificar al emisor ni tocar la biblioteca.
    async descartar(yo: number, id: number): Promise<RespuestaAccion> {
      return withTransaction(pool, async (tx) => {
        const fila = await cargarComoReceptor(tx, id, yo);
        const { siguiente, cambia, campoFecha } = transition(fila.estado, "DISCARD");
        if (cambia && campoFecha) {
          await tx.query(
            `UPDATE recomendacion SET estado = $2, ${campoFecha} = now() WHERE id = $1`,
            [id, siguiente],
          );
        }
        return { id, estado: siguiente };
      });
    },
  };
}

export type ServicioAcciones = ReturnType<typeof crearServicioAcciones>;
