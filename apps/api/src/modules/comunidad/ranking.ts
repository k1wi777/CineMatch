import type pg from "pg";
import type { TipoContenido } from "@cinematch/shared";

// Candidato del ranking. `generoIds` sirve para priorizar por intereses sin volver a consultar.
export type Candidato = {
  id: number;
  tipo: TipoContenido;
  titulo: string;
  anio: number | null;
  posterUrl: string | null;
  popularidad: number | null;
  promedio: number | null;
  calificaciones: number;
  generos: { id: number; nombre: string }[];
  generoIds: number[];
};

// Estrategia de ranking (patrón Strategy, BE-11.1): cada una devuelve candidatos ya ordenados.
export interface EstrategiaRanking {
  readonly nombre: "comunidad" | "popularidad";
  candidatos(pool: pg.Pool, limite: number, generoId?: number): Promise<Candidato[]>;
}

const LIMITE_GLOBAL = 200;
const LIMITE_POR_GENERO = 100;

type FilaBase = {
  id: number;
  tipo: TipoContenido;
  titulo: string;
  anio: number | null;
  poster_url: string | null;
  popularidad: string | null;
  promedio: string | null;
  calificaciones: string;
};

// Carga los géneros de todos los candidatos de una vez y arma el objeto final.
async function completar(pool: pg.Pool, filas: FilaBase[]): Promise<Candidato[]> {
  if (filas.length === 0) return [];
  const { rows } = await pool.query<{ contenido_id: number; id: number; nombre: string }>(
    `SELECT cg.contenido_id, g.id, g.nombre
       FROM contenido_genero cg JOIN genero g ON g.id = cg.genero_id
      WHERE cg.contenido_id = ANY($1::int[])
      ORDER BY g.nombre`,
    [filas.map((fila) => fila.id)],
  );
  const porTitulo = new Map<number, { id: number; nombre: string }[]>();
  for (const fila of rows) {
    const lista = porTitulo.get(fila.contenido_id) ?? [];
    lista.push({ id: fila.id, nombre: fila.nombre });
    porTitulo.set(fila.contenido_id, lista);
  }
  return filas.map((fila) => {
    const generos = porTitulo.get(fila.id) ?? [];
    return {
      id: fila.id,
      tipo: fila.tipo,
      titulo: fila.titulo,
      anio: fila.anio,
      posterUrl: fila.poster_url,
      popularidad: fila.popularidad === null ? null : Number(fila.popularidad),
      promedio: fila.promedio === null ? null : Number(Number(fila.promedio).toFixed(2)),
      calificaciones: Number(fila.calificaciones),
      generos,
      generoIds: generos.map((g) => g.id),
    };
  });
}

// Ranking comunitario (BE-11.1): promedio de reseñas no ocultas, solo títulos con el mínimo de calificaciones.
// Desempate: más calificaciones, luego popularidad externa.
export function crearRankingComunidad(minimoCalificaciones: number): EstrategiaRanking {
  return {
    nombre: "comunidad",
    async candidatos(pool, limite, generoId) {
      const filtroGenero = generoId
        ? "AND EXISTS (SELECT 1 FROM contenido_genero cg WHERE cg.contenido_id = c.id AND cg.genero_id = $3)"
        : "";
      const valores: unknown[] = [minimoCalificaciones, limite];
      if (generoId) valores.push(generoId);
      const { rows } = await pool.query<FilaBase>(
        `SELECT c.id, c.tipo, c.titulo, c.anio, c.poster_url, c.popularidad_externa AS popularidad,
                avg(r.calificacion) AS promedio, count(r.id) AS calificaciones
           FROM contenido c
           JOIN resena r ON r.contenido_id = c.id AND r.visible
          WHERE TRUE
            ${filtroGenero}
          GROUP BY c.id
         HAVING count(r.id) >= $1
          ORDER BY avg(r.calificacion) DESC, count(r.id) DESC, c.popularidad_externa DESC NULLS LAST, c.id
          LIMIT $2`,
        valores,
      );
      return completar(pool, rows);
    },
  };
}

// Respaldo por popularidad externa (BE-11.1): se usa para completar la lista en arranque en frío.
export function crearRankingPopularidad(): EstrategiaRanking {
  return {
    nombre: "popularidad",
    async candidatos(pool, limite, generoId) {
      const filtroGenero = generoId
        ? "WHERE EXISTS (SELECT 1 FROM contenido_genero cg WHERE cg.contenido_id = c.id AND cg.genero_id = $2)"
        : "";
      const valores: unknown[] = [limite];
      if (generoId) valores.push(generoId);
      const { rows } = await pool.query<FilaBase>(
        `SELECT c.id, c.tipo, c.titulo, c.anio, c.poster_url, c.popularidad_externa AS popularidad,
                NULL::numeric AS promedio, 0 AS calificaciones
           FROM contenido c
           ${filtroGenero}
          ORDER BY c.popularidad_externa DESC NULLS LAST, c.id
          LIMIT $1`,
        valores,
      );
      return completar(pool, rows);
    },
  };
}

export { LIMITE_GLOBAL, LIMITE_POR_GENERO };
