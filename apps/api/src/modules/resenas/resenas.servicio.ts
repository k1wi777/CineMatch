import {
  MAX_ETIQUETAS_RESENA,
  MAX_LONGITUD_ETIQUETA,
  normalizarEtiqueta,
  ResenaSchema,
  type EscribirResena,
  type Resena,
} from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { EventBus } from "../../lib/events.js";
import type { ServicioEstadoInterno } from "../biblioteca/biblioteca.estado.js";

export type DependenciasResenas = {
  pool: pg.Pool;
  eventos: EventBus;
  estado: ServicioEstadoInterno;
};

// Etiquetas: normalizadas, sin vacías ni repetidas, y dentro de los límites de RN6.
export function etiquetasNormalizadas(etiquetas: string[], tieneComentario: boolean): string[] {
  const normalizadas = [...new Set(etiquetas.map(normalizarEtiqueta).filter((t) => t.length > 0))];
  if (normalizadas.some((t) => t.length > MAX_LONGITUD_ETIQUETA)) {
    throw new ValidationError({
      etiquetas: `Cada etiqueta puede tener hasta ${MAX_LONGITUD_ETIQUETA} caracteres.`,
    });
  }
  if (normalizadas.length > MAX_ETIQUETAS_RESENA) {
    throw new ValidationError({
      etiquetas: `Puedes poner hasta ${MAX_ETIQUETAS_RESENA} etiquetas por reseña.`,
    });
  }
  if (normalizadas.length > 0 && !tieneComentario) {
    throw new ValidationError({
      etiquetas: "Las etiquetas solo se guardan si escribes un comentario.",
    });
  }
  return normalizadas;
}

type FilaResena = {
  id: number;
  contenido_id: number;
  calificacion: string;
  comentario: string | null;
  visibilidad: Resena["visibilidad"];
  es_spoiler: boolean;
  fecha_creacion: Date;
  fecha_edicion: Date | null;
  etiquetas: string[];
};

const SELECT_RESENA = `
  SELECT r.id, r.contenido_id, r.calificacion, r.comentario, r.visibilidad, r.es_spoiler,
         r.fecha_creacion, r.fecha_edicion,
         COALESCE(
           (SELECT array_agg(e.texto ORDER BY e.texto)
              FROM resena_etiqueta re JOIN etiqueta e ON e.id = re.etiqueta_id
             WHERE re.resena_id = r.id),
           '{}'
         ) AS etiquetas
    FROM resena r`;

function aResena(fila: FilaResena): Resena {
  return ResenaSchema.parse({
    id: fila.id,
    contenidoId: fila.contenido_id,
    calificacion: Number(fila.calificacion),
    comentario: fila.comentario,
    visibilidad: fila.visibilidad,
    esSpoiler: fila.es_spoiler,
    etiquetas: fila.etiquetas,
    fechaCreacion: fila.fecha_creacion.toISOString(),
    fechaEdicion: fila.fecha_edicion?.toISOString() ?? null,
  });
}

// Reseñas de los usuarios (BE-9.1 a BE-9.3). Escribir y editar son la misma operación: una reseña por usuario y título (RN1).
export function crearServicioResenas({ pool, eventos, estado }: DependenciasResenas) {
  return {
    // Crea o actualiza la reseña. Devuelve `creada: true` si era la primera vez.
    // Todo ocurre en una transacción: reseña, etiquetas, estado de biblioteca (vista, RN2) y evento.
    async guardar(
      usuarioId: number,
      contenidoId: number,
      datos: EscribirResena,
    ): Promise<{ resena: Resena; creada: boolean }> {
      const comentario = datos.comentario ? datos.comentario : null;
      const etiquetas = etiquetasNormalizadas(datos.etiquetas, comentario !== null);

      return withTransaction(pool, async (tx) => {
        const { rows: titulo } = await tx.query("SELECT 1 FROM contenido WHERE id = $1", [
          contenidoId,
        ]);
        if (titulo.length === 0) {
          throw new NotFoundError("El título no existe.");
        }

        const { rows } = await tx.query<{ id: number; creada: boolean }>(
          `INSERT INTO resena (usuario_id, contenido_id, calificacion, comentario, visibilidad, es_spoiler)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (usuario_id, contenido_id) DO UPDATE SET
             calificacion = EXCLUDED.calificacion,
             comentario = EXCLUDED.comentario,
             visibilidad = EXCLUDED.visibilidad,
             es_spoiler = EXCLUDED.es_spoiler,
             fecha_edicion = now()
           RETURNING id, (xmax = 0) AS creada`,
          [
            usuarioId,
            contenidoId,
            datos.calificacion,
            comentario,
            datos.visibilidad,
            datos.esSpoiler,
          ],
        );
        const fila = rows[0];
        if (!fila) {
          throw new Error("La inserción de la reseña no devolvió fila");
        }

        // Las etiquetas se reemplazan por completo: la edición sustituye el conjunto anterior.
        await tx.query("DELETE FROM resena_etiqueta WHERE resena_id = $1", [fila.id]);
        if (etiquetas.length > 0) {
          await tx.query(
            "INSERT INTO etiqueta (texto) SELECT unnest($1::text[]) ON CONFLICT (texto) DO NOTHING",
            [etiquetas],
          );
          await tx.query(
            `INSERT INTO resena_etiqueta (resena_id, etiqueta_id)
             SELECT $1, e.id FROM etiqueta e WHERE e.texto = ANY($2::text[])
             ON CONFLICT DO NOTHING`,
            [fila.id, etiquetas],
          );
        }

        // RN2: calificar marca el título como vista (si ya lo estaba, no cambia nada).
        await estado.markAs(tx, usuarioId, contenidoId, "vista");

        const { rows: cargada } = await tx.query<FilaResena>(`${SELECT_RESENA} WHERE r.id = $1`, [
          fila.id,
        ]);
        await eventos.emitInTransaction(tx, fila.creada ? "review.created" : "review.updated", {
          reviewId: fila.id,
          userId: usuarioId,
          contentId: contenidoId,
        });

        return { resena: aResena(cargada[0] as FilaResena), creada: fila.creada };
      });
    },

    // Solo el autor puede eliminar. Para cualquier otra persona la reseña no existe (404), así no se revela si está oculta.
    // Las etiquetas se borran en cascada; las recomendaciones conservan el motivo (RN14); la biblioteca no cambia.
    async eliminar(usuarioId: number, resenaId: number): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{ id: number; contenido_id: number }>(
          "SELECT id, contenido_id FROM resena WHERE id = $1 AND usuario_id = $2 FOR UPDATE",
          [resenaId, usuarioId],
        );
        const fila = rows[0];
        if (!fila) {
          throw new NotFoundError("La reseña no existe.");
        }
        await tx.query("DELETE FROM resena WHERE id = $1", [fila.id]);
        await eventos.emitInTransaction(tx, "review.deleted", {
          reviewId: fila.id,
          userId: usuarioId,
          contentId: fila.contenido_id,
        });
      });
    },
  };
}

export type ServicioResenas = ReturnType<typeof crearServicioResenas>;
