import type { ContadorNoLeidas, Notificacion, NotificacionesQuery } from "@cinematch/shared";
import type pg from "pg";
import { NotFoundError } from "../../lib/errors.js";
import { paginar } from "../../lib/pagination.js";
import {
  aNotificacion,
  SELECT_NOTIFICACION,
  type FilaNotificacion,
} from "./notificaciones.repository.js";

export type PaginaNotificaciones = {
  items: Notificacion[];
  page: number;
  pageSize: number;
  total: number;
};

// Lectura de notificaciones por su destinatario (BE-5.2). Todo filtra por el id de la sesión.
export function crearServicioConsulta(pool: pg.Pool) {
  return {
    async listar(usuarioId: number, query: NotificacionesQuery): Promise<PaginaNotificaciones> {
      const { limit, offset } = paginar(query);
      const condicion =
        "n.usuario_destinatario_id = $1 AND ($2::boolean = false OR n.leida = false)";

      const [filas, total] = await Promise.all([
        pool.query<FilaNotificacion>(
          `${SELECT_NOTIFICACION}
            WHERE ${condicion}
            ORDER BY n.fecha_creacion DESC, n.id DESC
            LIMIT $3 OFFSET $4`,
          [usuarioId, query.soloNoLeidas, limit, offset],
        ),
        pool.query<{ total: string }>(
          `SELECT count(*) AS total FROM notificacion n WHERE ${condicion}`,
          [usuarioId, query.soloNoLeidas],
        ),
      ]);

      return {
        items: filas.rows.map(aNotificacion),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
      };
    },

    async contarNoLeidas(usuarioId: number): Promise<ContadorNoLeidas> {
      const { rows } = await pool.query<{ total: string }>(
        "SELECT count(*) AS total FROM notificacion WHERE usuario_destinatario_id = $1 AND leida = false",
        [usuarioId],
      );
      return { noLeidas: Number(rows[0]?.total ?? 0) };
    },

    // Solo el destinatario puede marcarla. Para cualquier otro id responde como si no existiera (404),
    // así no se puede averiguar qué notificaciones ajenas existen. Marcarla dos veces no cambia nada.
    async marcarLeida(usuarioId: number, id: number): Promise<void> {
      const { rows } = await pool.query<{ id: number }>(
        `UPDATE notificacion
            SET leida = true, fecha_lectura = COALESCE(fecha_lectura, now())
          WHERE id = $1 AND usuario_destinatario_id = $2
          RETURNING id`,
        [id, usuarioId],
      );
      if (rows.length === 0) {
        throw new NotFoundError("La notificación no existe.");
      }
    },

    async marcarTodas(usuarioId: number): Promise<void> {
      await pool.query(
        `UPDATE notificacion
            SET leida = true, fecha_lectura = now()
          WHERE usuario_destinatario_id = $1 AND leida = false`,
        [usuarioId],
      );
    },
  };
}

export type ServicioConsulta = ReturnType<typeof crearServicioConsulta>;
