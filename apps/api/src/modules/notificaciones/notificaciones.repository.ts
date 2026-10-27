import { NotificacionSchema, type Notificacion } from "@cinematch/shared";
import type { Executor } from "../../lib/db.js";

// Fila de `notificacion` unida al origen (usuario que la provoca), con las columnas en snake_case.
export type FilaNotificacion = {
  id: number;
  tipo: string;
  fecha_creacion: Date;
  leida: boolean;
  fecha_lectura: Date | null;
  recomendacion_id: number | null;
  amistad_id: number | null;
  resena_id: number | null;
  origen_username: string | null;
  origen_avatar_url: string | null;
};

// Consulta común: el origen se une con LEFT JOIN porque puede no existir.
export const SELECT_NOTIFICACION = `
  SELECT n.id, n.tipo, n.fecha_creacion, n.leida, n.fecha_lectura,
         n.recomendacion_id, n.amistad_id, n.resena_id,
         o.username AS origen_username, o.avatar_url AS origen_avatar_url
    FROM notificacion n
    LEFT JOIN usuario o ON o.id = n.usuario_origen_id`;

// Convierte la fila en la forma pública (camelCase, fechas ISO, target único).
export function aNotificacion(fila: FilaNotificacion): Notificacion {
  const target =
    fila.recomendacion_id !== null
      ? { tipo: "recomendacion" as const, id: fila.recomendacion_id }
      : fila.amistad_id !== null
        ? { tipo: "amistad" as const, id: fila.amistad_id }
        : { tipo: "resena" as const, id: fila.resena_id ?? 0 };

  return NotificacionSchema.parse({
    id: fila.id,
    tipo: fila.tipo,
    fechaCreacion: fila.fecha_creacion.toISOString(),
    leida: fila.leida,
    fechaLectura: fila.fecha_lectura?.toISOString() ?? null,
    origen:
      fila.origen_username !== null
        ? { username: fila.origen_username, avatarUrl: fila.origen_avatar_url }
        : null,
    target,
  });
}

export async function obtenerNotificacion(ejecutor: Executor, id: number): Promise<Notificacion> {
  const { rows } = await ejecutor.query<FilaNotificacion>(
    `${SELECT_NOTIFICACION} WHERE n.id = $1`,
    [id],
  );
  const fila = rows[0];
  if (!fila) {
    throw new Error(`La notificación ${id} no existe justo después de crearse`);
  }
  return aNotificacion(fila);
}
