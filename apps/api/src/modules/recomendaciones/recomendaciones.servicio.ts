import {
  limpiarMotivo,
  MAX_MOTIVO_RECOMENDACION,
  RecomendacionSchema,
  type AmigoRecomendable,
  type EnviarRecomendacion,
  type Recomendacion,
} from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type { EventBus } from "../../lib/events.js";
import type { ServicioCreacion } from "../notificaciones/notificaciones.creacion.js";

export type DependenciasRecomendaciones = {
  pool: pg.Pool;
  eventos: EventBus;
  creacion: ServicioCreacion;
  amigos: {
    idsDeAmigos(usuarioId: number): Promise<number[]>;
    sonAmigos(a: number, b: number): Promise<boolean>;
  };
};

type FilaRecomendacion = {
  id: number;
  contenido_id: number;
  emisor_id: number;
  receptor_id: number;
  motivo: string | null;
  resena_id: number | null;
  fuera_de_intereses: boolean;
  estado: Recomendacion["estado"];
  fecha_envio: Date;
};

function aRecomendacion(fila: FilaRecomendacion): Recomendacion {
  return RecomendacionSchema.parse({
    id: fila.id,
    contenidoId: fila.contenido_id,
    emisorId: fila.emisor_id,
    receptorId: fila.receptor_id,
    motivo: fila.motivo,
    resenaId: fila.resena_id,
    fueraDeIntereses: fila.fuera_de_intereses,
    estado: fila.estado,
    fechaEnvio: fila.fecha_envio.toISOString(),
  });
}

// Recomendaciones dirigidas (BE-10.2 y BE-10.3). No exigen reseña previa.
export function crearServicioRecomendaciones({
  pool,
  eventos,
  creacion,
  amigos,
}: DependenciasRecomendaciones) {
  // ¿Comparten algún género el título y los intereses de la persona? Si no, la recomendación está fuera de sus intereses.
  async function generosEnComun(usuarioId: number, contenidoId: number): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT count(*) AS total
         FROM interes_usuario iu
         JOIN contenido_genero cg ON cg.genero_id = iu.genero_id
        WHERE iu.usuario_id = $1 AND cg.contenido_id = $2`,
      [usuarioId, contenidoId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  return {
    // Amigos a los que se puede recomendar el título: primero los que comparten géneros, luego el resto.
    async amigosRecomendables(yo: number, contenidoId: number): Promise<AmigoRecomendable[]> {
      const { rows: titulo } = await pool.query("SELECT 1 FROM contenido WHERE id = $1", [
        contenidoId,
      ]);
      if (titulo.length === 0) {
        throw new NotFoundError("El título no existe.");
      }
      const ids = await amigos.idsDeAmigos(yo);
      if (ids.length === 0) return [];

      const { rows } = await pool.query<{
        id: number;
        username: string;
        avatar_url: string | null;
        generos: string;
        ya_vio: boolean;
        ya_recomendada: boolean;
      }>(
        `SELECT u.id, u.username, u.avatar_url,
                (SELECT count(*) FROM interes_usuario iu
                   JOIN contenido_genero cg ON cg.genero_id = iu.genero_id
                  WHERE iu.usuario_id = u.id AND cg.contenido_id = $2) AS generos,
                EXISTS (SELECT 1 FROM seguimiento s
                         WHERE s.usuario_id = u.id AND s.contenido_id = $2 AND s.estado = 'vista') AS ya_vio,
                EXISTS (SELECT 1 FROM recomendacion r
                         WHERE r.emisor_id = $1 AND r.receptor_id = u.id AND r.contenido_id = $2) AS ya_recomendada
           FROM usuario u
          WHERE u.id = ANY($3::int[]) AND u.eliminado_en IS NULL`,
        [yo, contenidoId, ids],
      );

      return rows
        .map((fila) => {
          const comun = Number(fila.generos);
          return {
            id: fila.id,
            username: fila.username,
            avatarUrl: fila.avatar_url,
            generosEnComun: comun,
            fueraDeIntereses: comun === 0,
            yaLaVio: fila.ya_vio,
            yaRecomendada: fila.ya_recomendada,
            seleccionable: !fila.ya_vio && !fila.ya_recomendada,
          };
        })
        .sort(
          (a, b) =>
            Number(b.generosEnComun > 0) - Number(a.generosEnComun > 0) ||
            b.generosEnComun - a.generosEnComun ||
            a.username.localeCompare(b.username),
        );
    },

    // Envía la recomendación. Todo en una transacción; un bloqueo por la terna evita dos envíos simultáneos iguales.
    async enviar(yo: number, datos: EnviarRecomendacion): Promise<Recomendacion> {
      if (datos.amigoId === yo) {
        throw new ValidationError({ amigoId: "No puedes recomendarte un título a ti mismo." });
      }
      const motivo = datos.motivo ? limpiarMotivo(datos.motivo) : null;
      if (motivo && motivo.length > MAX_MOTIVO_RECOMENDACION) {
        throw new ValidationError({
          motivo: `El motivo puede tener hasta ${MAX_MOTIVO_RECOMENDACION} caracteres.`,
        });
      }

      return withTransaction(pool, async (tx) => {
        const { rows: titulo } = await tx.query("SELECT 1 FROM contenido WHERE id = $1", [
          datos.contentId,
        ]);
        if (titulo.length === 0) {
          throw new NotFoundError("El título no existe.");
        }
        if (!(await amigos.sonAmigos(yo, datos.amigoId))) {
          throw new ForbiddenError("Solo puedes recomendar títulos a tus amigos.");
        }
        const { rows: receptor } = await tx.query(
          "SELECT 1 FROM usuario WHERE id = $1 AND eliminado_en IS NULL",
          [datos.amigoId],
        );
        if (receptor.length === 0) {
          throw new NotFoundError("El usuario no existe.");
        }

        await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `recomendacion:${yo}:${datos.amigoId}:${datos.contentId}`,
        ]);

        const { rows: vista } = await tx.query(
          "SELECT 1 FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2 AND estado = 'vista'",
          [datos.amigoId, datos.contentId],
        );
        if (vista.length > 0) {
          throw new ConflictError("Tu amigo ya vio este título.");
        }
        const { rows: previa } = await tx.query(
          "SELECT 1 FROM recomendacion WHERE emisor_id = $1 AND receptor_id = $2 AND contenido_id = $3",
          [yo, datos.amigoId, datos.contentId],
        );
        if (previa.length > 0) {
          throw new ConflictError("Ya le recomendaste este título a esta persona.");
        }

        // La reseña adjunta debe ser de quien recomienda, del mismo título y no estar oculta.
        if (datos.resenaId) {
          const { rows: resena } = await tx.query(
            "SELECT 1 FROM resena WHERE id = $1 AND usuario_id = $2 AND contenido_id = $3 AND visible",
            [datos.resenaId, yo, datos.contentId],
          );
          if (resena.length === 0) {
            throw new ValidationError({
              resenaId: "La reseña no es tuya, no es de este título o está oculta.",
            });
          }
        }

        const comun = await generosEnComun(datos.amigoId, datos.contentId);
        const { rows } = await tx.query<FilaRecomendacion>(
          `INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, resena_id, motivo, fuera_de_intereses)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, contenido_id, emisor_id, receptor_id, motivo, resena_id,
                     fuera_de_intereses, estado, fecha_envio`,
          [yo, datos.amigoId, datos.contentId, datos.resenaId ?? null, motivo, comun === 0],
        );
        const fila = rows[0] as FilaRecomendacion;

        await creacion.crear(tx, {
          tipo: "recomendacion_recibida",
          destinatarioId: datos.amigoId,
          origenId: yo,
          referencia: { recomendacionId: fila.id },
        });
        await eventos.emitInTransaction(tx, "recommendation.sent", {
          recommendationId: fila.id,
          senderId: yo,
          receiverId: datos.amigoId,
          contentId: datos.contentId,
        });

        return aRecomendacion(fila);
      });
    },
  };
}

export type ServicioRecomendaciones = ReturnType<typeof crearServicioRecomendaciones>;
