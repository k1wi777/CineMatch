import type pg from "pg";
import type { ReglasDeNegocio } from "../../config/business-rules.js";
import { paginar } from "../../lib/pagination.js";
import {
  filtroEtiquetasComunidad,
  filtroPromedioAmigos,
  filtroPromedioPublico,
  visibleReviewsFilter,
} from "./visibilidad.js";

export type EstadisticasTitulo = {
  promedioPublico: number | null;
  conteoPublico: number;
  promedioAmigos: number | null;
  conteoAmigos: number;
  etiquetasComunidad: { texto: string; veces: number }[];
};

export type ResenaLista = {
  id: number;
  calificacion: number;
  etiquetas: string[];
  comentario: string | null;
  esSpoiler: boolean;
  visibilidad: "publica" | "amigos";
  fechaCreacion: string;
  fechaEdicion: string | null;
  autor: { id: number; username: string; avatarUrl: string | null; eliminado: boolean };
  contenido?: { id: number; titulo: string; posterUrl: string | null };
};

export type ResenaMia = ResenaLista & { ocultaPorModeracion: boolean };

type FilaResenaLista = {
  id: number;
  calificacion: string;
  comentario: string | null;
  es_spoiler: boolean;
  visibilidad: "publica" | "amigos";
  fecha_creacion: Date;
  fecha_edicion: Date | null;
  visible: boolean;
  autor_id: number;
  autor_username: string;
  autor_avatar: string | null;
  autor_eliminado: boolean;
  contenido_id: number;
  contenido_titulo: string;
  contenido_poster: string | null;
  etiquetas: string[];
};

const SELECT_LISTA = `
  SELECT r.id, r.calificacion, r.comentario, r.es_spoiler, r.visibilidad, r.fecha_creacion,
         r.fecha_edicion, r.visible,
         u.id AS autor_id, u.username AS autor_username, u.avatar_url AS autor_avatar,
         (u.eliminado_en IS NOT NULL) AS autor_eliminado,
         c.id AS contenido_id, c.titulo AS contenido_titulo, c.poster_url AS contenido_poster,
         COALESCE((SELECT array_agg(e.texto ORDER BY e.texto)
                     FROM resena_etiqueta re JOIN etiqueta e ON e.id = re.etiqueta_id
                    WHERE re.resena_id = r.id), '{}') AS etiquetas
    FROM resena r
    JOIN usuario u ON u.id = r.usuario_id
    JOIN contenido c ON c.id = r.contenido_id`;

function aLista(fila: FilaResenaLista, conContenido: boolean): ResenaLista {
  const base: ResenaLista = {
    id: fila.id,
    calificacion: Number(fila.calificacion),
    etiquetas: fila.etiquetas,
    comentario: fila.comentario,
    esSpoiler: fila.es_spoiler,
    visibilidad: fila.visibilidad,
    fechaCreacion: fila.fecha_creacion.toISOString(),
    fechaEdicion: fila.fecha_edicion?.toISOString() ?? null,
    autor: {
      id: fila.autor_id,
      username: fila.autor_username,
      avatarUrl: fila.autor_avatar,
      eliminado: fila.autor_eliminado,
    },
  };
  if (conContenido) {
    base.contenido = {
      id: fila.contenido_id,
      titulo: fila.contenido_titulo,
      posterUrl: fila.contenido_poster,
    };
  }
  return base;
}

export type DependenciasConsultaResenas = {
  pool: pg.Pool;
  reglas: ReglasDeNegocio;
};

// Lecturas de reseñas (BE-9.5 a BE-9.7). Todas usan la regla de visibilidad de visibilidad.ts.
export function crearServicioConsultaResenas({ pool, reglas }: DependenciasConsultaResenas) {
  return {
    // Agregados de la ficha (RN4, RN5 y RN7). Los promedios son anónimos.
    async estadisticas(titulo: number, espectador: number): Promise<EstadisticasTitulo> {
      const { rows: publico } = await pool.query<{ promedio: string | null; total: string }>(
        `SELECT avg(r.calificacion) AS promedio, count(*) AS total
           FROM resena r WHERE r.contenido_id = $1 AND ${filtroPromedioPublico("r")}`,
        [titulo],
      );
      const { rows: amigos } = await pool.query<{ promedio: string | null; total: string }>(
        `SELECT avg(r.calificacion) AS promedio, count(*) AS total
           FROM resena r WHERE r.contenido_id = $1
            AND ${filtroPromedioAmigos({ alias: "r", espectadorParam: "$2" })}`,
        [titulo, espectador],
      );
      const { rows: etiquetas } = await pool.query<{ texto: string; veces: string }>(
        `SELECT e.texto, count(*) AS veces
           FROM resena r
           JOIN resena_etiqueta re ON re.resena_id = r.id
           JOIN etiqueta e ON e.id = re.etiqueta_id
          WHERE r.contenido_id = $1 AND ${filtroEtiquetasComunidad("r")}
          GROUP BY e.texto
         HAVING count(*) >= $2
          ORDER BY count(*) DESC, e.texto ASC`,
        [titulo, reglas.TAG_MIN_REVIEWS],
      );

      const conteoAmigos = Number(amigos[0]?.total ?? 0);
      return {
        promedioPublico:
          publico[0]?.promedio == null ? null : Number(Number(publico[0].promedio).toFixed(2)),
        conteoPublico: Number(publico[0]?.total ?? 0),
        // Sin amigos con reseña, el promedio de amigos se omite (RN5).
        promedioAmigos:
          conteoAmigos === 0 || amigos[0]?.promedio == null
            ? null
            : Number(Number(amigos[0].promedio).toFixed(2)),
        conteoAmigos,
        etiquetasComunidad: etiquetas.map((fila) => ({
          texto: fila.texto,
          veces: Number(fila.veces),
        })),
      };
    },

    // Reseñas con comentario de un título que el espectador puede ver (BE-9.6). Aparte, la propia (incluso oculta).
    async resenasDeTitulo(
      titulo: number,
      espectador: number,
      pagina: { page: number; pageSize: number },
    ) {
      const { limit, offset } = paginar(pagina);
      // La propia reseña va aparte, en miResena, también cuando está oculta: no se repite en el listado.
      const condicion = `r.contenido_id = $1 AND r.usuario_id <> $2 AND r.comentario IS NOT NULL AND ${visibleReviewsFilter({ alias: "r", espectadorParam: "$2" })}`;
      const [filas, total] = await Promise.all([
        pool.query<FilaResenaLista>(
          `${SELECT_LISTA} WHERE ${condicion} ORDER BY r.fecha_creacion DESC, r.id DESC LIMIT $3 OFFSET $4`,
          [titulo, espectador, limit, offset],
        ),
        pool.query<{ total: string }>(`SELECT count(*) AS total FROM resena r WHERE ${condicion}`, [
          titulo,
          espectador,
        ]),
      ]);
      const { rows: mia } = await pool.query<FilaResenaLista>(
        `${SELECT_LISTA} WHERE r.contenido_id = $1 AND r.usuario_id = $2`,
        [titulo, espectador],
      );
      const propia = mia[0];
      return {
        items: filas.rows.map((fila) => aLista(fila, false)),
        page: pagina.page,
        pageSize: pagina.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
        miResena: propia
          ? { ...aLista(propia, false), ocultaPorModeracion: !propia.visible }
          : null,
      };
    },

    // Reseñas de un usuario que el espectador puede ver (BE-9.7). El propio usuario las ve todas.
    async resenasDeUsuario(
      autor: number,
      espectador: number,
      pagina: { page: number; pageSize: number },
    ) {
      const { limit, offset } = paginar(pagina);
      const condicion = `r.usuario_id = $1 AND ${visibleReviewsFilter({ alias: "r", espectadorParam: "$2" })}`;
      const [filas, total] = await Promise.all([
        pool.query<FilaResenaLista>(
          `${SELECT_LISTA} WHERE ${condicion} ORDER BY r.fecha_creacion DESC, r.id DESC LIMIT $3 OFFSET $4`,
          [autor, espectador, limit, offset],
        ),
        pool.query<{ total: string }>(`SELECT count(*) AS total FROM resena r WHERE ${condicion}`, [
          autor,
          espectador,
        ]),
      ]);
      return {
        items: filas.rows.map((fila) => aLista(fila, true)),
        page: pagina.page,
        pageSize: pagina.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
      };
    },
  };
}

export type ServicioConsultaResenas = ReturnType<typeof crearServicioConsultaResenas>;
