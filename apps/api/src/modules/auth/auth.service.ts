import type pg from "pg";
import type { ReglasDeNegocio } from "../../config/business-rules.js";
import { withTransaction } from "../../lib/db.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generarTokenDeSesion, hashToken } from "../../lib/session-token.js";
import type { UsuarioSesion } from "@cinematch/shared";
import { CredencialesInvalidasError, CuentaBloqueadaError } from "./auth.errors.js";
import {
  actualizarActividadSesion,
  actualizarIntentos,
  buscarSesion,
  buscarUsuarioParaLogin,
  eliminarSesion,
  insertarSesion,
} from "./auth.repository.js";

const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * MINUTO_MS;

export type DependenciasAuth = {
  pool: pg.Pool;
  reglas: ReglasDeNegocio;
  reloj: () => Date;
};

export type ContextoPeticion = { ip?: string; userAgent?: string };

export function crearServicioAuth({ pool, reglas, reloj }: DependenciasAuth) {
  // Hash usado cuando el correo no existe: así una búsqueda fallida cuesta lo mismo que una contraseña errónea.
  let hashFantasma: Promise<string> | undefined;
  const obtenerHashFantasma = () => (hashFantasma ??= hashPassword("contraseña-que-nadie-usa"));

  // Vencimiento deslizante por inactividad, con un tope absoluto desde el login.
  function vencimiento(ahora: Date, creadaEn: Date): Date {
    const porInactividad = ahora.getTime() + reglas.SESSION_IDLE_MINUTES * MINUTO_MS;
    const tope = creadaEn.getTime() + reglas.SESSION_ABSOLUTE_DAYS * DIA_MS;
    return new Date(Math.min(porInactividad, tope));
  }

  return {
    async login(
      correo: string,
      contrasena: string,
      contexto: ContextoPeticion,
    ): Promise<{ token: string; usuario: UsuarioSesion }> {
      // La transacción confirma también los intentos fallidos: por eso el error se lanza fuera de ella.
      const resultado = await withTransaction(pool, async (tx) => {
        const usuario = await buscarUsuarioParaLogin(tx, correo);
        if (!usuario || usuario.eliminadoEn) {
          await verifyPassword(await obtenerHashFantasma(), contrasena);
          return { ok: false as const, bloqueada: false };
        }

        const ahora = reloj();
        const bloqueada =
          usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta.getTime() > ahora.getTime();
        if (bloqueada) {
          return { ok: false as const, bloqueada: true };
        }

        // Un bloqueo ya vencido reinicia el contador.
        const intentosPrevios = usuario.bloqueadoHasta !== null ? 0 : usuario.intentosFallidos;
        const correcta = await verifyPassword(usuario.contrasena, contrasena);
        if (!correcta) {
          const intentos = intentosPrevios + 1;
          const bloqueoHasta =
            intentos >= reglas.LOGIN_MAX_ATTEMPTS
              ? new Date(ahora.getTime() + reglas.LOGIN_LOCK_MINUTES * MINUTO_MS)
              : null;
          await actualizarIntentos(tx, usuario.id, intentos, bloqueoHasta);
          return { ok: false as const, bloqueada: false };
        }

        await actualizarIntentos(tx, usuario.id, 0, null);
        // Cada login crea una sesión nueva; nunca se reutiliza un id anterior.
        const token = generarTokenDeSesion();
        await insertarSesion(tx, {
          id: hashToken(token),
          usuarioId: usuario.id,
          creadaEn: ahora,
          ultimaActividad: ahora,
          expiraEn: vencimiento(ahora, ahora),
          ip: contexto.ip ?? null,
          userAgent: contexto.userAgent ?? null,
        });
        return {
          ok: true as const,
          token,
          usuario: {
            id: usuario.id,
            username: usuario.username,
            nombre: usuario.nombre,
            rol: usuario.rol,
          },
        };
      });

      if (!resultado.ok) {
        throw resultado.bloqueada ? new CuentaBloqueadaError() : new CredencialesInvalidasError();
      }
      return { token: resultado.token, usuario: resultado.usuario };
    },

    async logout(token: string | undefined): Promise<void> {
      if (token) {
        await eliminarSesion(pool, hashToken(token));
      }
    },

    // Devuelve el usuario de una sesión vigente. Actualiza la actividad solo si pasó el intervalo configurado.
    // `tocar: false` valida la sesión sin registrar actividad (lo usa el canal SSE, BE-5.3).
    async resolverSesion(
      token: string,
      { tocar = true }: { tocar?: boolean } = {},
    ): Promise<UsuarioSesion | undefined> {
      const ahora = reloj();
      const sesion = await buscarSesion(pool, hashToken(token));
      if (!sesion || sesion.eliminadoEn || ahora.getTime() >= sesion.expiraEn.getTime()) {
        return undefined;
      }

      const desdeUltimaActividad = ahora.getTime() - sesion.ultimaActividad.getTime();
      if (tocar && desdeUltimaActividad > reglas.SESSION_TOUCH_SECONDS * 1_000) {
        await actualizarActividadSesion(
          pool,
          sesion.id,
          ahora,
          vencimiento(ahora, sesion.creadaEn),
        );
      }

      return {
        id: sesion.usuarioId,
        username: sesion.username,
        nombre: sesion.nombre,
        rol: sesion.rol,
      };
    },
  };
}

export type ServicioAuth = ReturnType<typeof crearServicioAuth>;
