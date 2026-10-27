import type { ReglasDeNegocio } from "../../config/business-rules.js";
import type pg from "pg";
import type { Logger } from "pino";
import { randomBytes } from "node:crypto";
import { withTransaction } from "../../lib/db.js";
import type { ServicioCorreo } from "../../lib/correo.js";
import { hashPassword } from "../../lib/password.js";
import { hashToken } from "../../lib/session-token.js";
import {
  TokenRecuperacionInvalidoError,
  TokenRecuperacionUsadoError,
  TokenRecuperacionVencidoError,
} from "./auth.errors.js";

const MINUTO_MS = 60_000;

export type DependenciasRecuperacion = {
  pool: pg.Pool;
  reglas: ReglasDeNegocio;
  reloj: () => Date;
  servicioCorreo: ServicioCorreo;
  webUrl: string;
  logger: Pick<Logger, "error">;
};

export function crearServicioRecuperacion({
  pool,
  reglas,
  reloj,
  servicioCorreo,
  webUrl,
  logger,
}: DependenciasRecuperacion) {
  return {
    // Responde igual exista o no el correo: el envío ocurre en segundo plano y no altera la respuesta.
    async solicitar(correo: string): Promise<void> {
      const { rows } = await pool.query<{ id: number }>(
        "SELECT id FROM usuario WHERE lower(correo) = lower($1) AND eliminado_en IS NULL",
        [correo],
      );
      const usuario = rows[0];
      if (!usuario) return;

      const token = randomBytes(32).toString("base64url");
      const expira = new Date(reloj().getTime() + reglas.RESET_TOKEN_TTL_MINUTES * MINUTO_MS);

      await withTransaction(pool, async (tx) => {
        // Cada solicitud invalida los enlaces anteriores de la cuenta.
        await tx.query("DELETE FROM token_recuperacion WHERE usuario_id = $1", [usuario.id]);
        await tx.query(
          "INSERT INTO token_recuperacion (id, usuario_id, fecha_expiracion) VALUES ($1, $2, $3)",
          [hashToken(token), usuario.id, expira],
        );
      });

      const enlace = `${webUrl}/restablecer?token=${encodeURIComponent(token)}`;
      servicioCorreo.enviarRecuperacion(correo, enlace).catch((err: unknown) => {
        logger.error({ err }, "No se pudo enviar el correo de recuperación");
      });
    },

    // Valida el enlace, guarda la nueva contraseña, marca el enlace como usado y cierra todas las sesiones.
    async restablecer(token: string, contrasena: string): Promise<void> {
      const hash = await hashPassword(contrasena);

      await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{
          id: string;
          usuario_id: number;
          fecha_expiracion: Date;
          usado: boolean;
          eliminado_en: Date | null;
        }>(
          `SELECT t.id, t.usuario_id, t.fecha_expiracion, t.usado, u.eliminado_en
             FROM token_recuperacion t
             JOIN usuario u ON u.id = t.usuario_id
            WHERE t.id = $1
            FOR UPDATE OF t`,
          [hashToken(token)],
        );
        const fila = rows[0];
        if (!fila || fila.eliminado_en) throw new TokenRecuperacionInvalidoError();
        if (fila.usado) throw new TokenRecuperacionUsadoError();
        if (fila.fecha_expiracion.getTime() <= reloj().getTime())
          throw new TokenRecuperacionVencidoError();

        await tx.query(
          "UPDATE usuario SET contrasena = $2, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1",
          [fila.usuario_id, hash],
        );
        await tx.query("UPDATE token_recuperacion SET usado = true WHERE id = $1", [fila.id]);
        await tx.query("DELETE FROM sesion WHERE usuario_id = $1", [fila.usuario_id]);
      });
    },
  };
}

export type ServicioRecuperacion = ReturnType<typeof crearServicioRecuperacion>;
