import type pg from "pg";
import type { EventosDeDominio } from "../../lib/events.js";
import type { ServicioCreacion } from "../notificaciones/notificaciones.creacion.js";
import { transition } from "./recommendation-state.js";

export type DependenciasCompletar = {
  creacion: ServicioCreacion;
};

// Listener de `review.created` (BE-10.6). Se ejecuta dentro de la transacción de la reseña:
// si algo falla, se revierten la reseña, la biblioteca, las recomendaciones y las notificaciones juntas.
// Solo la primera calificación del título completa recomendaciones; `review.updated` no pasa por aquí.
export function crearCompletarRecomendaciones({ creacion }: DependenciasCompletar) {
  return async (payload: EventosDeDominio["review.created"], tx: pg.PoolClient): Promise<void> => {
    const { rows } = await tx.query<{
      id: number;
      emisor_id: number;
      estado: "enviada" | "abierta" | "aceptada";
    }>(
      `SELECT id, emisor_id, estado FROM recomendacion
        WHERE receptor_id = $1 AND contenido_id = $2 AND estado IN ('enviada', 'abierta', 'aceptada')
        FOR UPDATE`,
      [payload.userId, payload.contentId],
    );

    for (const recomendacion of rows) {
      const { siguiente, campoFecha } = transition(recomendacion.estado, "COMPLETE");
      await tx.query(`UPDATE recomendacion SET estado = $2, ${campoFecha} = now() WHERE id = $1`, [
        recomendacion.id,
        siguiente,
      ]);
      await creacion.crear(tx, {
        tipo: "recomendacion_completada",
        destinatarioId: recomendacion.emisor_id,
        origenId: payload.userId,
        referencia: { recomendacionId: recomendacion.id },
      });
    }
  };
}
