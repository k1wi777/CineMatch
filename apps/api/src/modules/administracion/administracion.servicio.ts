import type { EstadoSincronizacion, ModeracionQuery, ResenaModeracion } from "@cinematch/shared";
import type pg from "pg";
import type { Logger } from "pino";
import { withTransaction } from "../../lib/db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { EventBus } from "../../lib/events.js";
import { paginar } from "../../lib/pagination.js";
import type { ServicioCreacion } from "../notificaciones/notificaciones.creacion.js";
import type { PoolComunidad } from "../comunidad/comunidad.servicio.js";
import type { ServicioSincronizacion } from "../catalogo/sincronizacion.js";

// Auditoría mínima (BE-12.4): se escribe dentro de la misma transacción que la acción auditada.
export async function registrarAuditoria(
  tx: pg.PoolClient,
  datos: {
    adminId: number;
    accion: string;
    entidad: string;
    entidadId: number | null;
    detalle: Record<string, unknown>;
  },
): Promise<void> {
  await tx.query(
    "INSERT INTO auditoria_admin (admin_id, accion, entidad, entidad_id, detalle) VALUES ($1, $2, $3, $4, $5)",
    [datos.adminId, datos.accion, datos.entidad, datos.entidadId, JSON.stringify(datos.detalle)],
  );
}

// ---------- Sincronización manual (BE-12.1) ----------

export type DependenciasSincronizacionAdmin = {
  sincronizacion: ServicioSincronizacion;
  cache: PoolComunidad;
  pool: pg.Pool;
  cantidadPorTipo: number;
  logger: Logger;
};

// Ejecuta la sincronización en segundo plano con un candado en memoria: una sola a la vez.
export function crearSincronizacionAdmin({
  sincronizacion,
  cache,
  pool,
  cantidadPorTipo,
  logger,
}: DependenciasSincronizacionAdmin) {
  let estado: EstadoSincronizacion = {
    estado: "inactiva",
    iniciadaEn: null,
    terminadaEn: null,
    ultimoResumen: null,
    error: null,
  };

  return {
    estado: (): EstadoSincronizacion => estado,

    // Devuelve enseguida: la sincronización sigue en segundo plano. 409 si ya hay una en curso.
    iniciar(adminId: number): EstadoSincronizacion {
      if (estado.estado === "en_curso") {
        throw new ConflictError("Ya hay una sincronización en curso.");
      }
      estado = {
        estado: "en_curso",
        iniciadaEn: new Date().toISOString(),
        terminadaEn: null,
        ultimoResumen: estado.ultimoResumen,
        error: null,
      };
      void ejecutar(adminId);
      return estado;
    },
  };

  async function ejecutar(adminId: number): Promise<void> {
    try {
      const resultado = await sincronizacion.sincronizar(cantidadPorTipo);
      const resumen = {
        agregados: resultado.agregados,
        actualizados: resultado.actualizados,
        descartados: resultado.descartados,
        generosAgregados: resultado.generosAgregados,
      };
      const final = resultado.estado === "ok" ? "ok" : "error";
      // El catálogo cambió: el pool de recomendaciones generales se recalcula antes de marcar la ejecución como terminada.
      await cache.recalcular();
      await withTransaction(pool, (tx) =>
        registrarAuditoria(tx, {
          adminId,
          accion: "sincronizar_catalogo",
          entidad: "catalogo",
          entidadId: null,
          detalle: { ...resumen, estado: final },
        }),
      );
      // Solo ahora el estado deja de ser "en_curso": quien consulta ve también el trabajo posterior terminado.
      estado = {
        estado: final,
        iniciadaEn: estado.iniciadaEn,
        terminadaEn: new Date().toISOString(),
        ultimoResumen: resumen,
        error: resultado.error ?? null,
      };
    } catch (err: unknown) {
      logger.error({ err }, "La sincronización manual del catálogo falló");
      estado = {
        estado: "error",
        iniciadaEn: estado.iniciadaEn,
        terminadaEn: new Date().toISOString(),
        ultimoResumen: estado.ultimoResumen,
        error: "La sincronización no pudo completarse.",
      };
    }
  }
}

export type SincronizacionAdmin = ReturnType<typeof crearSincronizacionAdmin>;

// ---------- Moderación de reseñas (BE-12.2 y BE-12.3) ----------

export type DependenciasModeracion = {
  pool: pg.Pool;
  eventos: EventBus;
  creacion: ServicioCreacion;
  cache: PoolComunidad;
};

type FilaModeracion = {
  id: number;
  calificacion: string;
  comentario: string | null;
  es_spoiler: boolean;
  visibilidad: "publica" | "amigos";
  visible: boolean;
  fecha_creacion: Date;
  autor_id: number;
  autor_username: string;
  contenido_id: number;
  contenido_titulo: string;
  contenido_tipo: "pelicula" | "serie";
  etiquetas: string[];
};

export function crearServicioModeracion({
  pool,
  eventos,
  creacion,
  cache,
}: DependenciasModeracion) {
  return {
    // Lista todas las reseñas para moderar, sin aplicar la regla de visibilidad de los usuarios.
    async listar(query: ModeracionQuery) {
      const condiciones: string[] = [];
      const valores: unknown[] = [];
      const agregar = (sql: string, valor: unknown) => {
        valores.push(valor);
        condiciones.push(sql.replace("?", `$${valores.length}`));
      };
      if (query.estado === "visible") condiciones.push("r.visible");
      if (query.estado === "oculta") condiciones.push("NOT r.visible");
      if (query.contentId) agregar("r.contenido_id = ?", query.contentId);
      if (query.autor) agregar("lower(u.username) = lower(?)", query.autor);
      if (query.q)
        agregar("r.comentario ILIKE ?", `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
      const { limit, offset } = paginar(query);
      const n = valores.length;

      const [filas, total] = await Promise.all([
        pool.query<FilaModeracion>(
          `SELECT r.id, r.calificacion, r.comentario, r.es_spoiler, r.visibilidad, r.visible, r.fecha_creacion,
                  u.id AS autor_id, u.username AS autor_username,
                  c.id AS contenido_id, c.titulo AS contenido_titulo, c.tipo AS contenido_tipo,
                  COALESCE((SELECT array_agg(e.texto ORDER BY e.texto)
                              FROM resena_etiqueta re JOIN etiqueta e ON e.id = re.etiqueta_id
                             WHERE re.resena_id = r.id), '{}') AS etiquetas
             FROM resena r
             JOIN usuario u ON u.id = r.usuario_id
             JOIN contenido c ON c.id = r.contenido_id
             ${where}
            ORDER BY r.fecha_creacion DESC, r.id DESC
            LIMIT $${n + 1} OFFSET $${n + 2}`,
          [...valores, limit, offset],
        ),
        pool.query<{ total: string }>(
          `SELECT count(*) AS total FROM resena r JOIN usuario u ON u.id = r.usuario_id ${where}`,
          valores,
        ),
      ]);

      return {
        items: filas.rows.map((fila): ResenaModeracion => ({
          id: fila.id,
          calificacion: Number(fila.calificacion),
          etiquetas: fila.etiquetas,
          comentario: fila.comentario,
          esSpoiler: fila.es_spoiler,
          visibilidad: fila.visibilidad,
          visible: fila.visible,
          fechaCreacion: fila.fecha_creacion.toISOString(),
          autor: { id: fila.autor_id, username: fila.autor_username },
          contenido: {
            id: fila.contenido_id,
            titulo: fila.contenido_titulo,
            tipo: fila.contenido_tipo,
          },
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
      };
    },

    // Oculta una reseña. Idempotente: si ya estaba oculta, no notifica ni emite de nuevo.
    async ocultar(adminId: number, resenaId: number): Promise<void> {
      const cambio = await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{
          usuario_id: number;
          contenido_id: number;
          visible: boolean;
        }>("SELECT usuario_id, contenido_id, visible FROM resena WHERE id = $1 FOR UPDATE", [
          resenaId,
        ]);
        const fila = rows[0];
        if (!fila) throw new NotFoundError("La reseña no existe.");
        if (!fila.visible) return false;

        await tx.query("UPDATE resena SET visible = false WHERE id = $1", [resenaId]);
        await creacion.crear(tx, {
          tipo: "resena_oculta",
          destinatarioId: fila.usuario_id,
          referencia: { resenaId },
        });
        await eventos.emitInTransaction(tx, "review.hidden", {
          reviewId: resenaId,
          userId: fila.usuario_id,
          contentId: fila.contenido_id,
        });
        await registrarAuditoria(tx, {
          adminId,
          accion: "ocultar_resena",
          entidad: "resena",
          entidadId: resenaId,
          detalle: { autorId: fila.usuario_id, contenidoId: fila.contenido_id },
        });
        return true;
      });
      if (cambio) await cache.recalcular();
    },

    // Restablece una reseña oculta. Idempotente. No notifica al autor (el ERS solo define aviso al ocultar).
    async restablecer(adminId: number, resenaId: number): Promise<void> {
      const cambio = await withTransaction(pool, async (tx) => {
        const { rows } = await tx.query<{
          usuario_id: number;
          contenido_id: number;
          visible: boolean;
        }>("SELECT usuario_id, contenido_id, visible FROM resena WHERE id = $1 FOR UPDATE", [
          resenaId,
        ]);
        const fila = rows[0];
        if (!fila) throw new NotFoundError("La reseña no existe.");
        if (fila.visible) return false;

        await tx.query("UPDATE resena SET visible = true WHERE id = $1", [resenaId]);
        await eventos.emitInTransaction(tx, "review.restored", {
          reviewId: resenaId,
          userId: fila.usuario_id,
          contentId: fila.contenido_id,
        });
        await registrarAuditoria(tx, {
          adminId,
          accion: "restablecer_resena",
          entidad: "resena",
          entidadId: resenaId,
          detalle: { autorId: fila.usuario_id, contenidoId: fila.contenido_id },
        });
        return true;
      });
      if (cambio) await cache.recalcular();
    },
  };
}

export type ServicioModeracion = ReturnType<typeof crearServicioModeracion>;
