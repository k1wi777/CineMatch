import type { Notificacion, NotificationType } from "@cinematch/shared";
import type pg from "pg";
import { afterCommit } from "../../lib/db.js";
import { obtenerNotificacion } from "./notificaciones.repository.js";

// Referencia que cada tipo exige: exactamente una, la del elemento que la origina (ERS).
export type ReferenciaNotificacion = {
  recomendacionId?: number;
  amistadId?: number;
  resenaId?: number;
};

export type DatosNotificacion = {
  tipo: NotificationType;
  destinatarioId: number;
  origenId?: number;
  referencia: ReferenciaNotificacion;
};

const CAMPO_POR_TIPO: Record<NotificationType, keyof ReferenciaNotificacion> = {
  recomendacion_recibida: "recomendacionId",
  recomendacion_aceptada: "recomendacionId",
  recomendacion_completada: "recomendacionId",
  solicitud_amistad: "amistadId",
  amistad_aceptada: "amistadId",
  resena_oculta: "resenaId",
};

// Canal de entrega en vivo. BE-5.3 lo implementa con SSE; hasta entonces no hace nada.
export type EmisorNotificaciones = {
  emitir(destinatarioId: number, notificacion: Notificacion): void;
};

export const EMISOR_SIN_CONEXIONES: EmisorNotificaciones = {
  emitir() {},
};

export type DependenciasCreacion = {
  emisor?: EmisorNotificaciones;
};

// Crea notificaciones dentro de la transacción del llamador: si esa transacción revierte, la notificación desaparece.
// La emisión en vivo se programa con afterCommit, así que nunca avisa de algo que no quedó guardado.
export function crearServicioCreacion({
  emisor = EMISOR_SIN_CONEXIONES,
}: DependenciasCreacion = {}) {
  return {
    // Debe llamarse dentro de withTransaction: afterCommit lanza si no hay transacción.
    async crear(tx: pg.PoolClient, datos: DatosNotificacion): Promise<Notificacion> {
      const campoEsperado = CAMPO_POR_TIPO[datos.tipo];
      const referenciasPresentes = (
        Object.keys(datos.referencia) as (keyof ReferenciaNotificacion)[]
      ).filter((campo) => datos.referencia[campo] !== undefined);
      if (referenciasPresentes.length !== 1 || referenciasPresentes[0] !== campoEsperado) {
        throw new Error(`El tipo ${datos.tipo} exige exactamente la referencia ${campoEsperado}`);
      }

      const { rows } = await tx.query<{ id: number }>(
        `INSERT INTO notificacion
           (usuario_destinatario_id, usuario_origen_id, tipo,
            recomendacion_id, amistad_id, resena_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          datos.destinatarioId,
          datos.origenId ?? null,
          datos.tipo,
          datos.referencia.recomendacionId ?? null,
          datos.referencia.amistadId ?? null,
          datos.referencia.resenaId ?? null,
        ],
      );
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error("La inserción de la notificación no devolvió id");
      }

      const notificacion = await obtenerNotificacion(tx, id);
      afterCommit(tx, () => emisor.emitir(datos.destinatarioId, notificacion));
      return notificacion;
    },
  };
}

export type ServicioCreacion = ReturnType<typeof crearServicioCreacion>;
