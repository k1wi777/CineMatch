import type { Genero } from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { ValidationError } from "../../lib/errors.js";

// Géneros de interés del usuario (BE-4.3). Leer no necesita transacción; reemplazar sí,
// para que el conjunto nunca quede a medias si falla una inserción.
export function crearServicioIntereses(pool: pg.Pool) {
  return {
    async obtener(usuarioId: number): Promise<Genero[]> {
      const { rows } = await pool.query<Genero>(
        `SELECT g.id, g.nombre
           FROM interes_usuario iu
           JOIN genero g ON g.id = iu.genero_id
          WHERE iu.usuario_id = $1
          ORDER BY g.nombre, g.id`,
        [usuarioId],
      );
      return rows;
    },

    // Sustituye el conjunto completo. Los ids repetidos o inexistentes se rechazan antes de tocar datos.
    async reemplazar(usuarioId: number, generoIds: number[]): Promise<Genero[]> {
      return withTransaction(pool, async (tx) => {
        const { rows: existentes } = await tx.query<{ total: string }>(
          "SELECT count(*) AS total FROM genero WHERE id = ANY($1::int[])",
          [generoIds],
        );
        if (Number(existentes[0]?.total) !== generoIds.length) {
          throw new ValidationError({ generoIds: "Alguno de los géneros elegidos no existe." });
        }

        await tx.query("DELETE FROM interes_usuario WHERE usuario_id = $1", [usuarioId]);
        await tx.query(
          "INSERT INTO interes_usuario (usuario_id, genero_id) SELECT $1, unnest($2::int[])",
          [usuarioId, generoIds],
        );

        const { rows } = await tx.query<Genero>(
          `SELECT g.id, g.nombre
             FROM interes_usuario iu
             JOIN genero g ON g.id = iu.genero_id
            WHERE iu.usuario_id = $1
            ORDER BY g.nombre, g.id`,
          [usuarioId],
        );
        return rows;
      });
    },
  };
}

export type ServicioIntereses = ReturnType<typeof crearServicioIntereses>;
