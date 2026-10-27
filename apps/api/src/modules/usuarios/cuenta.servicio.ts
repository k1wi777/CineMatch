import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import type pg from "pg";
import type { Logger } from "pino";
import { afterCommit, withTransaction } from "../../lib/db.js";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import type { HubNotificaciones } from "../notificaciones/notificaciones.stream.js";

// Patrón de los archivos de avatar que genera el servidor: solo se borra lo que lo cumple y pertenece al usuario.
const PATRON_AVATAR = /^(\d+)-[0-9a-f]{32}\.webp$/;

export type DependenciasCuenta = {
  pool: pg.Pool;
  hub: HubNotificaciones;
  directorioAvatares: string;
  logger: Logger;
};

export type ExportacionDatos = {
  exportadoEn: string;
  perfil: {
    id: number;
    nombre: string;
    username: string;
    correo: string | null;
    bio: string | null;
    avatarUrl: string | null;
    fechaRegistro: string;
  };
  intereses: { id: number; nombre: string }[];
  resenas: {
    id: number;
    contenidoId: number;
    calificacion: number;
    comentario: string | null;
    visibilidad: string;
    esSpoiler: boolean;
    etiquetas: string[];
    fechaCreacion: string;
    fechaEdicion: string | null;
  }[];
  biblioteca: { contenidoId: number; estado: string; fechaActualizacion: string }[];
  amigos: { username: string }[];
  recomendaciones: {
    enviadas: {
      id: number;
      contenidoId: number;
      estado: string;
      motivo: string | null;
      fechaEnvio: string;
      receptor: string;
    }[];
    recibidas: {
      id: number;
      contenidoId: number;
      estado: string;
      motivo: string | null;
      fechaEnvio: string;
      emisor: string;
    }[];
  };
};

// Derechos de datos (Ley 1581) y eliminación de cuenta (BE-13.1).
export function crearServicioCuenta({ pool, hub, directorioAvatares, logger }: DependenciasCuenta) {
  return {
    // Todo lo que la base guarda de la persona, en JSON.
    async exportar(usuarioId: number): Promise<ExportacionDatos> {
      const { rows: perfil } = await pool.query<{
        id: number;
        nombre: string;
        username: string;
        correo: string | null;
        bio: string | null;
        avatar_url: string | null;
        fecha_registro: Date;
      }>(
        "SELECT id, nombre, username, correo, bio, avatar_url, fecha_registro FROM usuario WHERE id = $1 AND eliminado_en IS NULL",
        [usuarioId],
      );
      const yo = perfil[0];
      if (!yo) throw new UnauthorizedError();

      const [intereses, resenas, biblioteca, amigos, enviadas, recibidas] = await Promise.all([
        pool.query<{ id: number; nombre: string }>(
          "SELECT g.id, g.nombre FROM interes_usuario iu JOIN genero g ON g.id = iu.genero_id WHERE iu.usuario_id = $1 ORDER BY g.nombre",
          [usuarioId],
        ),
        pool.query<{
          id: number;
          contenido_id: number;
          calificacion: string;
          comentario: string | null;
          visibilidad: string;
          es_spoiler: boolean;
          fecha_creacion: Date;
          fecha_edicion: Date | null;
          etiquetas: string[];
        }>(
          `SELECT r.id, r.contenido_id, r.calificacion, r.comentario, r.visibilidad, r.es_spoiler,
                  r.fecha_creacion, r.fecha_edicion,
                  COALESCE((SELECT array_agg(e.texto ORDER BY e.texto) FROM resena_etiqueta re
                              JOIN etiqueta e ON e.id = re.etiqueta_id WHERE re.resena_id = r.id), '{}') AS etiquetas
             FROM resena r WHERE r.usuario_id = $1 ORDER BY r.id`,
          [usuarioId],
        ),
        pool.query<{ contenido_id: number; estado: string; fecha_actualizacion: Date }>(
          "SELECT contenido_id, estado, fecha_actualizacion FROM seguimiento WHERE usuario_id = $1 ORDER BY contenido_id",
          [usuarioId],
        ),
        pool.query<{ username: string }>(
          `SELECT u.username FROM amistad a
             JOIN usuario u ON u.id = CASE WHEN a.solicitante_id = $1 THEN a.receptor_id ELSE a.solicitante_id END
            WHERE a.estado = 'aceptada' AND ($1 = a.solicitante_id OR $1 = a.receptor_id)
            ORDER BY u.username`,
          [usuarioId],
        ),
        pool.query<{
          id: number;
          contenido_id: number;
          estado: string;
          motivo: string | null;
          fecha_envio: Date;
          receptor: string;
        }>(
          `SELECT r.id, r.contenido_id, r.estado, r.motivo, r.fecha_envio, u.username AS receptor
             FROM recomendacion r JOIN usuario u ON u.id = r.receptor_id WHERE r.emisor_id = $1 ORDER BY r.id`,
          [usuarioId],
        ),
        pool.query<{
          id: number;
          contenido_id: number;
          estado: string;
          motivo: string | null;
          fecha_envio: Date;
          emisor: string;
        }>(
          `SELECT r.id, r.contenido_id, r.estado, r.motivo, r.fecha_envio, u.username AS emisor
             FROM recomendacion r JOIN usuario u ON u.id = r.emisor_id WHERE r.receptor_id = $1 ORDER BY r.id`,
          [usuarioId],
        ),
      ]);

      return {
        exportadoEn: new Date().toISOString(),
        perfil: {
          id: yo.id,
          nombre: yo.nombre,
          username: yo.username,
          correo: yo.correo,
          bio: yo.bio,
          avatarUrl: yo.avatar_url,
          fechaRegistro: yo.fecha_registro.toISOString(),
        },
        intereses: intereses.rows,
        resenas: resenas.rows.map((r) => ({
          id: r.id,
          contenidoId: r.contenido_id,
          calificacion: Number(r.calificacion),
          comentario: r.comentario,
          visibilidad: r.visibilidad,
          esSpoiler: r.es_spoiler,
          etiquetas: r.etiquetas,
          fechaCreacion: r.fecha_creacion.toISOString(),
          fechaEdicion: r.fecha_edicion?.toISOString() ?? null,
        })),
        biblioteca: biblioteca.rows.map((b) => ({
          contenidoId: b.contenido_id,
          estado: b.estado,
          fechaActualizacion: b.fecha_actualizacion.toISOString(),
        })),
        amigos: amigos.rows,
        recomendaciones: {
          enviadas: enviadas.rows.map((r) => ({
            id: r.id,
            contenidoId: r.contenido_id,
            estado: r.estado,
            motivo: r.motivo,
            fechaEnvio: r.fecha_envio.toISOString(),
            receptor: r.receptor,
          })),
          recibidas: recibidas.rows.map((r) => ({
            id: r.id,
            contenidoId: r.contenido_id,
            estado: r.estado,
            motivo: r.motivo,
            fechaEnvio: r.fecha_envio.toISOString(),
            emisor: r.emisor,
          })),
        },
      };
    },

    // Elimina la cuenta: anonimiza la fila, conserva las reseñas y borra el resto de datos personales.
    // Todo en una transacción; el avatar y los streams se tratan después del COMMIT.
    async eliminar(usuarioId: number, contrasena: string): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{
          contrasena: string;
          avatar_url: string | null;
          rol: string;
        }>(
          `SELECT u.contrasena, u.avatar_url, r.nombre AS rol
             FROM usuario u JOIN rol r ON r.id = u.rol_id
            WHERE u.id = $1 AND u.eliminado_en IS NULL FOR UPDATE OF u`,
          [usuarioId],
        );
        const cuenta = rows[0];
        if (!cuenta) throw new UnauthorizedError();
        if (cuenta.rol === "administrador") {
          throw new ForbiddenError(
            "Un administrador no puede eliminar su cuenta desde este endpoint.",
          );
        }
        if (!(await verifyPassword(cuenta.contrasena, contrasena))) {
          throw new ValidationError({ password: "La contraseña no es correcta." });
        }

        await tx.query("DELETE FROM sesion WHERE usuario_id = $1", [usuarioId]);
        await tx.query("DELETE FROM token_recuperacion WHERE usuario_id = $1", [usuarioId]);
        await tx.query("DELETE FROM interes_usuario WHERE usuario_id = $1", [usuarioId]);
        await tx.query("DELETE FROM seguimiento WHERE usuario_id = $1", [usuarioId]);
        await tx.query("DELETE FROM amistad WHERE solicitante_id = $1 OR receptor_id = $1", [
          usuarioId,
        ]);
        await tx.query("DELETE FROM recomendacion WHERE emisor_id = $1 OR receptor_id = $1", [
          usuarioId,
        ]);
        await tx.query(
          "DELETE FROM notificacion WHERE usuario_destinatario_id = $1 OR usuario_origen_id = $1",
          [usuarioId],
        );

        // Hash válido pero desconocido: nadie puede iniciar sesión con esta cuenta.
        const inutilizable = await hashPassword(randomBytes(32).toString("hex"));
        await tx.query(
          `UPDATE usuario
              SET nombre = 'Usuario eliminado', username = 'eliminado_' || id, correo = NULL,
                  contrasena = $2, avatar_url = NULL, bio = NULL, eliminado_en = now()
            WHERE id = $1`,
          [usuarioId, inutilizable],
        );

        afterCommit(tx, () => hub.cerrarUsuario(usuarioId));
        if (cuenta.avatar_url) {
          afterCommit(tx, () => borrarAvatar(cuenta.avatar_url as string, usuarioId));
        }
      });
    },
  };

  // Borra el archivo del avatar si cumple el patrón y pertenece al usuario. Un fallo no revierte la eliminación.
  async function borrarAvatar(avatarUrl: string, usuarioId: number): Promise<void> {
    const archivo = basename(avatarUrl);
    const coincidencia = PATRON_AVATAR.exec(archivo);
    if (!coincidencia || coincidencia[1] !== String(usuarioId)) {
      logger.warn({ usuarioId }, "Ruta de avatar fuera del patrón; no se borra");
      return;
    }
    await unlink(join(directorioAvatares, archivo)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT")
        logger.warn({ usuarioId }, "No se pudo borrar el avatar de la cuenta eliminada");
    });
  }
}

export type ServicioCuenta = ReturnType<typeof crearServicioCuenta>;
