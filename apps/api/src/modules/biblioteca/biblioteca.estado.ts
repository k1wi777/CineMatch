import type { EstadoBiblioteca } from "@cinematch/shared";
import type pg from "pg";

// Servicio interno de estado (BE-8.3). Lo usan reseñas (RN2) y recomendaciones, dentro de su propia transacción.
// Nunca abre transacción por su cuenta: el llamador pasa su `tx` para que el cambio se confirme o revierta con el resto.
export function crearServicioEstadoInterno(pool: pg.Pool) {
  return {
    // Marca el título para el usuario respetando las reglas de no degradación:
    // - Si ya tiene ese mismo estado, no cambia nada (idempotente, no toca la fecha).
    // - `pendiente` (al aceptar una recomendación) solo crea la entrada; nunca reemplaza un estado existente.
    // - Los demás estados sustituyen al actual (p. ej., calificar pasa a `vista`, RN2).
    async markAs(
      tx: pg.PoolClient,
      usuarioId: number,
      contenidoId: number,
      estado: EstadoBiblioteca,
    ): Promise<void> {
      if (estado === "pendiente") {
        await tx.query(
          `INSERT INTO seguimiento (usuario_id, contenido_id, estado)
           VALUES ($1, $2, 'pendiente')
           ON CONFLICT (usuario_id, contenido_id) DO NOTHING`,
          [usuarioId, contenidoId],
        );
        return;
      }
      await tx.query(
        `INSERT INTO seguimiento (usuario_id, contenido_id, estado)
         VALUES ($1, $2, $3::estado_biblioteca)
         ON CONFLICT (usuario_id, contenido_id) DO UPDATE
           SET estado = EXCLUDED.estado, fecha_actualizacion = now()
         WHERE seguimiento.estado <> EXCLUDED.estado`,
        [usuarioId, contenidoId, estado],
      );
    },

    // ¿Ya marcó el usuario este título como vista?
    async hasSeen(usuarioId: number, contenidoId: number): Promise<boolean> {
      const { rows } = await pool.query(
        "SELECT 1 FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2 AND estado = 'vista'",
        [usuarioId, contenidoId],
      );
      return rows.length > 0;
    },

    // De una lista de amigos, ¿quiénes ya marcaron el título como vista? Devuelve sus ids.
    async getSeenFriendIds(amigosIds: number[], contenidoId: number): Promise<number[]> {
      if (amigosIds.length === 0) return [];
      const { rows } = await pool.query<{ usuario_id: number }>(
        `SELECT usuario_id FROM seguimiento
          WHERE usuario_id = ANY($1::int[]) AND contenido_id = $2 AND estado = 'vista'`,
        [amigosIds, contenidoId],
      );
      return rows.map((fila) => fila.usuario_id);
    },
  };
}

export type ServicioEstadoInterno = ReturnType<typeof crearServicioEstadoInterno>;
