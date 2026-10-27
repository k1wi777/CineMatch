import type { RelacionUsuario, UsuarioResumen } from "@cinematch/shared";
import type pg from "pg";
import { paginar } from "../../lib/pagination.js";

export type Pagina<T> = { items: T[]; page: number; pageSize: number; total: number };

type FilaUsuario = { id: number; username: string; nombre: string; avatar_url: string | null };

function aUsuario(fila: FilaUsuario): UsuarioResumen {
  return { id: fila.id, username: fila.username, nombre: fila.nombre, avatarUrl: fila.avatar_url };
}

// Escapa % y _ para que la búsqueda use el texto literal.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

// Lecturas de la red de amigos (BE-7.3) y búsqueda de usuarios (BE-7.5). Nunca escriben.
export function crearServicioConsultaAmistades(pool: pg.Pool) {
  // Paginación genérica: `total` y `items` con la misma condición.
  async function paginado<T>(
    pagina: { page: number; pageSize: number },
    consulta: { sql: string; params: unknown[] },
    contarSql: string,
    mapear: (fila: never) => T,
  ): Promise<Pagina<T>> {
    const { limit, offset } = paginar(pagina);
    const n = consulta.params.length;
    const [filas, total] = await Promise.all([
      pool.query(`${consulta.sql} LIMIT $${n + 1} OFFSET $${n + 2}`, [
        ...consulta.params,
        limit,
        offset,
      ]),
      pool.query<{ total: string }>(contarSql, consulta.params),
    ]);
    return {
      items: filas.rows.map((fila) => mapear(fila as never)),
      page: pagina.page,
      pageSize: pagina.pageSize,
      total: Number(total.rows[0]?.total ?? 0),
    };
  }

  // Columnas del otro usuario de la relación, según quién es la sesión.
  const OTRO_USUARIO = (yo: string) =>
    `CASE WHEN a.solicitante_id = ${yo} THEN a.receptor_id ELSE a.solicitante_id END`;

  return {
    async listarAmigos(yo: number, pagina: { page: number; pageSize: number }) {
      return paginado<{ amistadId: number; usuario: UsuarioResumen }>(
        pagina,
        {
          sql: `SELECT a.id AS amistad_id, u.id, u.username, u.nombre, u.avatar_url
                  FROM amistad a
                  JOIN usuario u ON u.id = ${OTRO_USUARIO("$1")}
                 WHERE a.estado = 'aceptada' AND ($1 = a.solicitante_id OR $1 = a.receptor_id)
                   AND u.eliminado_en IS NULL
                 ORDER BY u.username ASC, a.id ASC`,
          params: [yo],
        },
        `SELECT count(*) AS total FROM amistad a
          JOIN usuario u ON u.id = ${OTRO_USUARIO("$1")}
         WHERE a.estado = 'aceptada' AND ($1 = a.solicitante_id OR $1 = a.receptor_id)
           AND u.eliminado_en IS NULL`,
        (fila: { amistad_id: number } & FilaUsuario) => ({
          amistadId: fila.amistad_id,
          usuario: aUsuario(fila),
        }),
      );
    },

    async listarRecibidas(yo: number, pagina: { page: number; pageSize: number }) {
      return paginado<{ id: number; usuario: UsuarioResumen; fechaSolicitud: string }>(
        pagina,
        {
          sql: `SELECT a.id, a.fecha_solicitud, u.id AS uid, u.username, u.nombre, u.avatar_url
                  FROM amistad a
                  JOIN usuario u ON u.id = a.solicitante_id
                 WHERE a.estado = 'pendiente' AND a.receptor_id = $1 AND u.eliminado_en IS NULL
                 ORDER BY a.fecha_solicitud DESC, a.id DESC`,
          params: [yo],
        },
        `SELECT count(*) AS total FROM amistad a
          JOIN usuario u ON u.id = a.solicitante_id
         WHERE a.estado = 'pendiente' AND a.receptor_id = $1 AND u.eliminado_en IS NULL`,
        (fila: {
          id: number;
          fecha_solicitud: Date;
          uid: number;
          username: string;
          nombre: string;
          avatar_url: string | null;
        }) => ({
          id: fila.id,
          usuario: aUsuario({
            id: fila.uid,
            username: fila.username,
            nombre: fila.nombre,
            avatar_url: fila.avatar_url,
          }),
          fechaSolicitud: fila.fecha_solicitud.toISOString(),
        }),
      );
    },

    async listarEnviadas(yo: number, pagina: { page: number; pageSize: number }) {
      return paginado<{ id: number; usuario: UsuarioResumen; fechaSolicitud: string }>(
        pagina,
        {
          sql: `SELECT a.id, a.fecha_solicitud, u.id AS uid, u.username, u.nombre, u.avatar_url
                  FROM amistad a
                  JOIN usuario u ON u.id = a.receptor_id
                 WHERE a.estado = 'pendiente' AND a.solicitante_id = $1 AND u.eliminado_en IS NULL
                 ORDER BY a.fecha_solicitud DESC, a.id DESC`,
          params: [yo],
        },
        `SELECT count(*) AS total FROM amistad a
          JOIN usuario u ON u.id = a.receptor_id
         WHERE a.estado = 'pendiente' AND a.solicitante_id = $1 AND u.eliminado_en IS NULL`,
        (fila: {
          id: number;
          fecha_solicitud: Date;
          uid: number;
          username: string;
          nombre: string;
          avatar_url: string | null;
        }) => ({
          id: fila.id,
          usuario: aUsuario({
            id: fila.uid,
            username: fila.username,
            nombre: fila.nombre,
            avatar_url: fila.avatar_url,
          }),
          fechaSolicitud: fila.fecha_solicitud.toISOString(),
        }),
      );
    },

    async contarRecibidasPendientes(yo: number): Promise<number> {
      const { rows } = await pool.query<{ total: string }>(
        `SELECT count(*) AS total FROM amistad a
           JOIN usuario u ON u.id = a.solicitante_id
          WHERE a.estado = 'pendiente' AND a.receptor_id = $1 AND u.eliminado_en IS NULL`,
        [yo],
      );
      return Number(rows[0]?.total ?? 0);
    },

    // Utilidades internas para otros módulos (reseñas privadas, biblioteca compartida, recomendaciones).
    async sonAmigos(a: number, b: number): Promise<boolean> {
      if (a === b) return false;
      const { rows } = await pool.query(
        `SELECT 1 FROM amistad
          WHERE estado = 'aceptada'
            AND LEAST(solicitante_id, receptor_id) = LEAST($1::int, $2::int)
            AND GREATEST(solicitante_id, receptor_id) = GREATEST($1::int, $2::int)`,
        [a, b],
      );
      return rows.length > 0;
    },

    async idsDeAmigos(usuarioId: number): Promise<number[]> {
      const { rows } = await pool.query<{ otro: number }>(
        `SELECT ${OTRO_USUARIO("$1")} AS otro
           FROM amistad a
          WHERE a.estado = 'aceptada' AND ($1 = a.solicitante_id OR $1 = a.receptor_id)`,
        [usuarioId],
      );
      return rows.map((fila) => fila.otro);
    },

    // Búsqueda parcial por username, sin distinguir mayúsculas. Excluye a la propia sesión y a las cuentas eliminadas.
    // La relación se calcula para la sesión; una solicitud rechazada se muestra como "ninguna" para no revelarla.
    async buscarUsuarios(yo: number, q: string, pagina: { page: number; pageSize: number }) {
      const patron = `%${escaparLike(q.toLowerCase())}%`;
      const relacion = `CASE
          WHEN a.id IS NULL OR a.estado = 'rechazada' THEN 'ninguna'
          WHEN a.estado = 'aceptada' THEN 'amigos'
          WHEN a.solicitante_id = $1 THEN 'pendienteEnviada'
          ELSE 'pendienteRecibida' END`;
      const desde = `FROM usuario u
          LEFT JOIN amistad a ON LEAST(a.solicitante_id, a.receptor_id) = LEAST(u.id, $1::int)
                             AND GREATEST(a.solicitante_id, a.receptor_id) = GREATEST(u.id, $1::int)
         WHERE u.eliminado_en IS NULL AND u.id <> $1 AND lower(u.username) LIKE $2`;
      return paginado<{
        id: number;
        username: string;
        nombre: string;
        avatarUrl: string | null;
        relacion: RelacionUsuario;
      }>(
        pagina,
        {
          sql: `SELECT u.id, u.username, u.nombre, u.avatar_url, ${relacion} AS relacion ${desde}
                ORDER BY u.username ASC, u.id ASC`,
          params: [yo, patron],
        },
        `SELECT count(*) AS total ${desde}`,
        (fila: FilaUsuario & { relacion: RelacionUsuario }) => ({
          ...aUsuario(fila),
          relacion: fila.relacion,
        }),
      );
    },
  };
}

export type ServicioConsultaAmistades = ReturnType<typeof crearServicioConsultaAmistades>;
