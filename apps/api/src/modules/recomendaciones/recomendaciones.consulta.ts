import {
  type FiltrarRecibidasQuery,
  type RecomendacionDetalle,
  type RecomendacionListaItem,
  type RecommendationStatus,
} from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { NotFoundError } from "../../lib/errors.js";
import { paginar } from "../../lib/pagination.js";
import { visibleReviewsFilter } from "../resenas/visibilidad.js";
import { transition } from "./recommendation-state.js";

type FilaRecomendacion = {
  id: number;
  estado: RecommendationStatus;
  fuera_de_intereses: boolean;
  fecha_envio: Date;
  fecha_apertura: Date | null;
  fecha_respuesta: Date | null;
  fecha_completado: Date | null;
  motivo: string | null;
  resena_id: number | null;
  emisor_id: number;
  emisor_username: string;
  emisor_avatar: string | null;
  receptor_id: number;
  receptor_username: string;
  receptor_avatar: string | null;
  contenido_id: number;
  contenido_titulo: string;
  contenido_poster: string | null;
};

const SELECT_RECOMENDACION = `
  SELECT r.id, r.estado, r.fuera_de_intereses, r.fecha_envio, r.fecha_apertura, r.fecha_respuesta,
         r.fecha_completado, r.motivo, r.resena_id,
         e.id AS emisor_id, e.username AS emisor_username, e.avatar_url AS emisor_avatar,
         rc.id AS receptor_id, rc.username AS receptor_username, rc.avatar_url AS receptor_avatar,
         c.id AS contenido_id, c.titulo AS contenido_titulo, c.poster_url AS contenido_poster
    FROM recomendacion r
    JOIN usuario e ON e.id = r.emisor_id
    JOIN usuario rc ON rc.id = r.receptor_id
    JOIN contenido c ON c.id = r.contenido_id`;

function aLista(fila: FilaRecomendacion): RecomendacionListaItem {
  return {
    id: fila.id,
    estado: fila.estado,
    fueraDeIntereses: fila.fuera_de_intereses,
    fechaEnvio: fila.fecha_envio.toISOString(),
    emisor: { id: fila.emisor_id, username: fila.emisor_username, avatarUrl: fila.emisor_avatar },
    receptor: {
      id: fila.receptor_id,
      username: fila.receptor_username,
      avatarUrl: fila.receptor_avatar,
    },
    contenido: {
      id: fila.contenido_id,
      titulo: fila.contenido_titulo,
      posterUrl: fila.contenido_poster,
    },
  };
}

type ResenaVista = {
  calificacion: number;
  etiquetas: string[];
  esSpoiler: boolean;
  comentario: string | null;
};

// Reseña de `autor` sobre el título, solo si `espectador` puede verla (regla de BE-9.4).
async function resenaVisible(
  pool: pg.Pool,
  filtroDe: "por-id" | "por-autor",
  autor: number,
  contenido: number,
  espectador: number,
  resenaId: number | null,
): Promise<ResenaVista | null> {
  const filtro = visibleReviewsFilter({ alias: "r", espectadorParam: "$2" });
  const condicion =
    filtroDe === "por-id" ? "r.id = $1" : "r.usuario_id = $1 AND r.contenido_id = $3";
  const valores = filtroDe === "por-id" ? [resenaId, espectador] : [autor, espectador, contenido];
  const { rows } = await pool.query<{
    calificacion: string;
    comentario: string | null;
    es_spoiler: boolean;
    etiquetas: string[];
  }>(
    `SELECT r.calificacion, r.comentario, r.es_spoiler,
            COALESCE((SELECT array_agg(e.texto ORDER BY e.texto)
                        FROM resena_etiqueta re JOIN etiqueta e ON e.id = re.etiqueta_id
                       WHERE re.resena_id = r.id), '{}') AS etiquetas
       FROM resena r
      WHERE ${condicion} AND ${filtro}`,
    valores,
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    calificacion: Number(fila.calificacion),
    etiquetas: fila.etiquetas,
    esSpoiler: fila.es_spoiler,
    comentario: fila.comentario,
  };
}

export type DependenciasConsultaRecomendaciones = {
  pool: pg.Pool;
};

// Lecturas de recomendaciones (BE-10.4 y BE-10.7). Abrir una recomendación enviada es parte del detalle (BE-10.4).
export function crearServicioConsultaRecomendaciones({
  pool,
}: DependenciasConsultaRecomendaciones) {
  async function cargar(id: number): Promise<FilaRecomendacion | undefined> {
    const { rows } = await pool.query<FilaRecomendacion>(
      `${SELECT_RECOMENDACION} WHERE r.id = $1`,
      [id],
    );
    return rows[0];
  }

  async function paginarListado(
    condicion: string,
    valores: unknown[],
    pagina: { page: number; pageSize: number },
  ) {
    const { limit, offset } = paginar(pagina);
    const n = valores.length;
    const [filas, total] = await Promise.all([
      pool.query<FilaRecomendacion>(
        `${SELECT_RECOMENDACION} WHERE ${condicion}
          ORDER BY r.fecha_envio DESC, r.id DESC
          LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...valores, limit, offset],
      ),
      pool.query<{ total: string }>(
        `SELECT count(*) AS total FROM recomendacion r WHERE ${condicion}`,
        valores,
      ),
    ]);
    return {
      items: filas.rows.map(aLista),
      page: pagina.page,
      pageSize: pagina.pageSize,
      total: Number(total.rows[0]?.total ?? 0),
    };
  }

  return {
    // Recomendaciones recibidas, con filtro de estado (BE-10.4).
    async recibidas(yo: number, query: FiltrarRecibidasQuery) {
      const valores: unknown[] = [yo];
      let condicion = "r.receptor_id = $1";
      if (query.estado) {
        valores.push(query.estado);
        condicion += ` AND r.estado = $${valores.length}::estado_recomendacion`;
      }
      return paginarListado(condicion, valores, query);
    },

    // Recomendaciones enviadas (BE-10.7).
    async enviadas(yo: number, pagina: { page: number; pageSize: number }) {
      return paginarListado("r.emisor_id = $1", [yo], pagina);
    },

    // Detalle: solo emisor y receptor; otros reciben 404. Si el receptor lo abre por primera vez, pasa a `abierta`.
    async detalle(yo: number, id: number): Promise<RecomendacionDetalle> {
      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{
          estado: RecommendationStatus;
          receptor_id: number;
          emisor_id: number;
        }>("SELECT estado, receptor_id, emisor_id FROM recomendacion WHERE id = $1 FOR UPDATE", [
          id,
        ]);
        const fila = rows[0];
        if (!fila || (fila.receptor_id !== yo && fila.emisor_id !== yo)) {
          throw new NotFoundError("La recomendación no existe.");
        }
        if (fila.receptor_id === yo && fila.estado === "enviada") {
          const { siguiente, campoFecha } = transition(fila.estado, "OPEN");
          await tx.query(
            `UPDATE recomendacion SET estado = $2, ${campoFecha} = now() WHERE id = $1`,
            [id, siguiente],
          );
        }
      });

      const fila = await cargar(id);
      if (!fila) {
        throw new NotFoundError("La recomendación no existe.");
      }

      // La reseña adjunta se muestra al receptor solo si es visible para él (BE-9.4).
      const resenaAdjunta =
        fila.resena_id !== null
          ? await resenaVisible(
              pool,
              "por-id",
              fila.emisor_id,
              fila.contenido_id,
              fila.receptor_id,
              fila.resena_id,
            )
          : null;

      // Si está completada, el emisor ve la calificación del receptor cuando le es visible (BE-9.4).
      const resenaReceptor =
        fila.estado === "completada" && fila.emisor_id === yo
          ? await resenaVisible(pool, "por-autor", fila.receptor_id, fila.contenido_id, yo, null)
          : null;

      return {
        ...aLista(fila),
        motivo: fila.motivo,
        fechaApertura: fila.fecha_apertura?.toISOString() ?? null,
        fechaRespuesta: fila.fecha_respuesta?.toISOString() ?? null,
        fechaCompletado: fila.fecha_completado?.toISOString() ?? null,
        resenaAdjunta,
        resenaReceptor,
      };
    },
  };
}

export type ServicioConsultaRecomendaciones = ReturnType<
  typeof crearServicioConsultaRecomendaciones
>;
