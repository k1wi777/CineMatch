import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type pg from "pg";
import type { Logger } from "pino";
import { afterCommit, withTransaction } from "../../lib/db.js";
import { UnauthorizedError, UnsupportedMediaTypeError, ValidationError } from "../../lib/errors.js";
import { detectarFormatoImagen, procesarAvatar } from "../../lib/imagen.js";

// Prefijo público bajo el que se sirven los avatares (express.static en app.ts).
export const RUTA_PUBLICA_AVATARES = "/uploads/avatars";

// Nombre generado por el servidor: <userId>-<hex aleatorio>.webp. Solo se borra lo que cumple este patrón.
const PATRON_ARCHIVO_AVATAR = /^(\d+)-[0-9a-f]{32}\.webp$/;

export type DependenciasAvatar = {
  pool: pg.Pool;
  directorio: string;
  logger: Logger;
};

// Avatar local (BE-4.4). La imagen se valida por firma, se procesa y solo después se escribe en disco.
// El archivo nuevo y la fila de usuario cambian juntos: si la base falla, el archivo nuevo se borra.
export function crearServicioAvatar({ pool, directorio, logger }: DependenciasAvatar) {
  // Borra un archivo de avatar anterior. Un fallo aquí no debe deshacer el cambio ya confirmado:
  // como mucho queda un archivo huérfano, que se registra.
  async function eliminarArchivo(avatarUrl: string | null, usuarioId: number): Promise<void> {
    if (!avatarUrl) return;
    const archivo = basename(avatarUrl);
    const coincidencia = PATRON_ARCHIVO_AVATAR.exec(archivo);
    if (!coincidencia || coincidencia[1] !== String(usuarioId)) {
      logger.warn({ usuarioId }, "Ruta de avatar anterior fuera del patrón; no se borra");
      return;
    }
    await unlink(join(directorio, archivo)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") {
        logger.warn({ usuarioId, codigo: err.code }, "No se pudo borrar el avatar anterior");
      }
    });
  }

  return {
    async subir(usuarioId: number, original: Buffer): Promise<string> {
      if (!detectarFormatoImagen(original)) {
        throw new UnsupportedMediaTypeError("Solo se aceptan imágenes JPEG, PNG o WebP.");
      }
      const imagen = await procesarAvatar(original).catch(() => {
        throw new ValidationError({
          avatar: "No se pudo procesar la imagen. Prueba con otro archivo.",
        });
      });

      const archivo = `${usuarioId}-${randomBytes(16).toString("hex")}.webp`;
      const ruta = `${RUTA_PUBLICA_AVATARES}/${archivo}`;
      await mkdir(directorio, { recursive: true });
      await writeFile(join(directorio, archivo), imagen);

      try {
        await withTransaction(pool, async (tx) => {
          const { rows } = await tx.query<{ avatar_url: string | null }>(
            "SELECT avatar_url FROM usuario WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
            [usuarioId],
          );
          const fila = rows[0];
          if (!fila) {
            throw new UnauthorizedError();
          }
          await tx.query("UPDATE usuario SET avatar_url = $2 WHERE id = $1", [usuarioId, ruta]);
          const anterior = fila.avatar_url;
          afterCommit(tx, () => eliminarArchivo(anterior, usuarioId));
        });
      } catch (err) {
        await unlink(join(directorio, archivo)).catch(() => undefined);
        throw err;
      }

      return ruta;
    },

    async eliminar(usuarioId: number): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{ avatar_url: string | null }>(
          "SELECT avatar_url FROM usuario WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
          [usuarioId],
        );
        const fila = rows[0];
        if (!fila) {
          throw new UnauthorizedError();
        }
        await tx.query("UPDATE usuario SET avatar_url = NULL WHERE id = $1", [usuarioId]);
        const anterior = fila.avatar_url;
        afterCommit(tx, () => eliminarArchivo(anterior, usuarioId));
      });
    },
  };
}

export type ServicioAvatar = ReturnType<typeof crearServicioAvatar>;
