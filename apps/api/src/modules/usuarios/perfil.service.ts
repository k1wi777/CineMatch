import { PerfilSchema, type ActualizarPerfil, type Perfil } from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { textoPlano } from "../../lib/text.js";

type FilaPerfil = {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const CAMPOS_PERFIL = "id, nombre, username, correo, bio, avatar_url";

function aPerfil(fila: FilaPerfil): Perfil {
  return PerfilSchema.parse({
    id: fila.id,
    nombre: fila.nombre,
    username: fila.username,
    correo: fila.correo,
    bio: fila.bio,
    avatarUrl: fila.avatar_url,
  });
}

// Perfil propio (BE-4.2). Todas las operaciones reciben el id de la sesión, nunca del cuerpo.
// La unicidad del username la garantiza el índice sobre lower(username): su violación sale como 409.
export function crearServicioPerfil(pool: pg.Pool) {
  return {
    async obtener(usuarioId: number): Promise<Perfil | undefined> {
      const { rows } = await pool.query<FilaPerfil>(
        `SELECT ${CAMPOS_PERFIL} FROM usuario WHERE id = $1 AND eliminado_en IS NULL`,
        [usuarioId],
      );
      const fila = rows[0];
      return fila ? aPerfil(fila) : undefined;
    },

    async actualizar(usuarioId: number, cambios: ActualizarPerfil): Promise<Perfil | undefined> {
      const asignaciones: string[] = [];
      const valores: unknown[] = [];
      const asignar = (columna: string, valor: unknown) => {
        valores.push(valor);
        asignaciones.push(`${columna} = $${valores.length}`);
      };

      if (cambios.nombre !== undefined) asignar("nombre", textoPlano(cambios.nombre));
      if (cambios.username !== undefined) asignar("username", cambios.username);
      if (cambios.bio !== undefined)
        asignar("bio", cambios.bio ? textoPlano(cambios.bio) || null : null);

      valores.push(usuarioId);
      const { rows } = await pool.query<FilaPerfil>(
        `UPDATE usuario SET ${asignaciones.join(", ")}
          WHERE id = $${valores.length} AND eliminado_en IS NULL
          RETURNING ${CAMPOS_PERFIL}`,
        valores,
      );
      const fila = rows[0];
      return fila ? aPerfil(fila) : undefined;
    },

    // Cambia la contraseña y cierra las demás sesiones del usuario, todo en una transacción:
    // o cambian ambas cosas o ninguna. La sesión actual se conserva para no cerrar la sesión de quien cambia la clave.
    async cambiarContrasena(
      usuarioId: number,
      sesionActual: string,
      contrasenaActual: string,
      contrasenaNueva: string,
    ): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{ contrasena: string }>(
          "SELECT contrasena FROM usuario WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
          [usuarioId],
        );
        const hash = rows[0]?.contrasena;
        if (hash === undefined) {
          throw new UnauthorizedError();
        }
        if (!(await verifyPassword(hash, contrasenaActual))) {
          throw new ValidationError({ contrasenaActual: "La contraseña actual no es correcta." });
        }

        const nuevoHash = await hashPassword(contrasenaNueva);
        await tx.query("UPDATE usuario SET contrasena = $2 WHERE id = $1", [usuarioId, nuevoHash]);
        await tx.query("DELETE FROM sesion WHERE usuario_id = $1 AND id <> $2", [
          usuarioId,
          sesionActual,
        ]);
      });
    },
  };
}

export type ServicioPerfil = ReturnType<typeof crearServicioPerfil>;
