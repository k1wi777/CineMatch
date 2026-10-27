import type { Executor } from "../../lib/db.js";

// Filas de la base traducidas a camelCase (el mapeo snake_case → camelCase vive aquí).
export type UsuarioParaLogin = {
  id: number;
  username: string;
  nombre: string;
  rol: "usuario" | "administrador";
  contrasena: string;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  eliminadoEn: Date | null;
};

export type SesionConUsuario = {
  id: string;
  usuarioId: number;
  creadaEn: Date;
  ultimaActividad: Date;
  expiraEn: Date;
  eliminadoEn: Date | null;
  username: string;
  nombre: string;
  rol: "usuario" | "administrador";
};

// Bloquea la fila del usuario (FOR UPDATE) para que dos intentos simultáneos no pisen el contador.
export async function buscarUsuarioParaLogin(
  db: Executor,
  correo: string,
): Promise<UsuarioParaLogin | undefined> {
  const { rows } = await db.query<{
    id: number;
    username: string;
    nombre: string;
    rol: "usuario" | "administrador";
    contrasena: string;
    intentos_fallidos: number;
    bloqueado_hasta: Date | null;
    eliminado_en: Date | null;
  }>(
    `SELECT u.id, u.username, u.nombre, r.nombre AS rol, u.contrasena,
            u.intentos_fallidos, u.bloqueado_hasta, u.eliminado_en
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE lower(u.correo) = lower($1)
      FOR UPDATE OF u`,
    [correo],
  );
  const fila = rows[0];
  if (!fila) return undefined;
  return {
    id: fila.id,
    username: fila.username,
    nombre: fila.nombre,
    rol: fila.rol,
    contrasena: fila.contrasena,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta,
    eliminadoEn: fila.eliminado_en,
  };
}

export async function actualizarIntentos(
  db: Executor,
  usuarioId: number,
  intentos: number,
  bloqueadoHasta: Date | null,
): Promise<void> {
  await db.query("UPDATE usuario SET intentos_fallidos = $2, bloqueado_hasta = $3 WHERE id = $1", [
    usuarioId,
    intentos,
    bloqueadoHasta,
  ]);
}

export async function insertarSesion(
  db: Executor,
  sesion: {
    id: string;
    usuarioId: number;
    creadaEn: Date;
    ultimaActividad: Date;
    expiraEn: Date;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO sesion (id, usuario_id, creada_en, ultima_actividad, expira_en, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      sesion.id,
      sesion.usuarioId,
      sesion.creadaEn,
      sesion.ultimaActividad,
      sesion.expiraEn,
      sesion.ip,
      sesion.userAgent,
    ],
  );
}

export async function buscarSesion(
  db: Executor,
  id: string,
): Promise<SesionConUsuario | undefined> {
  const { rows } = await db.query<{
    id: string;
    usuario_id: number;
    creada_en: Date;
    ultima_actividad: Date;
    expira_en: Date;
    eliminado_en: Date | null;
    username: string;
    nombre: string;
    rol: "usuario" | "administrador";
  }>(
    `SELECT s.id, s.usuario_id, s.creada_en, s.ultima_actividad, s.expira_en,
            u.eliminado_en, u.username, u.nombre, r.nombre AS rol
       FROM sesion s
       JOIN usuario u ON u.id = s.usuario_id
       JOIN rol r ON r.id = u.rol_id
      WHERE s.id = $1`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return undefined;
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    creadaEn: fila.creada_en,
    ultimaActividad: fila.ultima_actividad,
    expiraEn: fila.expira_en,
    eliminadoEn: fila.eliminado_en,
    username: fila.username,
    nombre: fila.nombre,
    rol: fila.rol,
  };
}

export async function actualizarActividadSesion(
  db: Executor,
  id: string,
  ultimaActividad: Date,
  expiraEn: Date,
): Promise<void> {
  await db.query("UPDATE sesion SET ultima_actividad = $2, expira_en = $3 WHERE id = $1", [
    id,
    ultimaActividad,
    expiraEn,
  ]);
}

export async function eliminarSesion(db: Executor, id: string): Promise<void> {
  await db.query("DELETE FROM sesion WHERE id = $1", [id]);
}
