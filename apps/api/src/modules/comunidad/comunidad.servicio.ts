import type { RecomendacionComunidad, RecomendacionesComunidadQuery } from "@cinematch/shared";
import type pg from "pg";
import type { ReglasDeNegocio } from "../../config/business-rules.js";
import { paginar } from "../../lib/pagination.js";
import {
  crearRankingComunidad,
  crearRankingPopularidad,
  LIMITE_GLOBAL,
  LIMITE_POR_GENERO,
  type Candidato,
  type EstrategiaRanking,
} from "./ranking.js";

type Pool = Map<string, Candidato[]>;

export type DependenciasComunidad = {
  pool: pg.Pool;
  reglas: ReglasDeNegocio;
  reloj: () => Date;
};

// Pool de candidatos en caché (BE-11.2): top global y por género. Se recalcula al expirar el TTL
// o a mano con recalcular(). No depende de ningún usuario: el filtrado personal se aplica al servir.
export function crearPoolComunidad({ pool, reglas, reloj }: DependenciasComunidad) {
  const comunidad: EstrategiaRanking = crearRankingComunidad(reglas.COMMUNITY_MIN_RATINGS);
  const popularidad: EstrategiaRanking = crearRankingPopularidad();
  const ttlMs = reglas.COMMUNITY_CACHE_TTL_MINUTES * 60_000;

  let calculadoEn: number | null = null;
  let poolComunidad: Pool = new Map();
  let poolPopularidad: Pool = new Map();

  async function calcular(estrategia: EstrategiaRanking, generos: number[]): Promise<Pool> {
    const resultado: Pool = new Map();
    resultado.set("global", await estrategia.candidatos(pool, LIMITE_GLOBAL));
    for (const generoId of generos) {
      resultado.set(
        `g:${generoId}`,
        await estrategia.candidatos(pool, LIMITE_POR_GENERO, generoId),
      );
    }
    return resultado;
  }

  return {
    async recalcular(): Promise<void> {
      const { rows } = await pool.query<{ id: number }>("SELECT id FROM genero ORDER BY id");
      const generos = rows.map((fila) => fila.id);
      poolComunidad = await calcular(comunidad, generos);
      poolPopularidad = await calcular(popularidad, generos);
      calculadoEn = reloj().getTime();
    },

    // Se llama al arrancar la API y antes de servir. Recalcula solo si el pool no existe o expiró.
    async asegurar(): Promise<void> {
      if (calculadoEn === null || reloj().getTime() - calculadoEn >= ttlMs) {
        await this.recalcular();
      }
    },

    obtener(alcance: string): { comunidad: Candidato[]; popularidad: Candidato[] } {
      return {
        comunidad: poolComunidad.get(alcance) ?? [],
        popularidad: poolPopularidad.get(alcance) ?? [],
      };
    },
  };
}

export type PoolComunidad = ReturnType<typeof crearPoolComunidad>;

export type DependenciasServicioComunidad = {
  pool: pg.Pool;
  cache: PoolComunidad;
};

// Recomendaciones generales para una persona (BE-11.3): sin amigos, excluye lo ya visto y prioriza sus intereses.
export function crearServicioComunidad({ pool, cache }: DependenciasServicioComunidad) {
  return {
    async recomendar(yo: number, query: RecomendacionesComunidadQuery) {
      await cache.asegurar();
      const alcance = query.generoId ? `g:${query.generoId}` : "global";
      const { comunidad, popularidad } = cache.obtener(alcance);

      // Títulos que ya vio: marcados como vista en la biblioteca o con reseña propia.
      const { rows: vistos } = await pool.query<{ contenido_id: number }>(
        `SELECT contenido_id FROM seguimiento WHERE usuario_id = $1 AND estado = 'vista'
         UNION SELECT contenido_id FROM resena WHERE usuario_id = $1`,
        [yo],
      );
      const excluidos = new Set(vistos.map((fila) => fila.contenido_id));

      // Intereses de la persona: géneros que comparten con los candidatos.
      const { rows: intereses } = await pool.query<{ genero_id: number }>(
        "SELECT genero_id FROM interes_usuario WHERE usuario_id = $1",
        [yo],
      );
      const generosDeInteres = new Set(intereses.map((fila) => fila.genero_id));

      // Primero el ranking comunitario; después, el respaldo por popularidad sin repetir títulos.
      const enComunidad = new Set(comunidad.map((c) => c.id));
      const candidatos: { candidato: Candidato; origen: RecomendacionComunidad["origen"] }[] = [
        ...comunidad.map((candidato) => ({ candidato, origen: "comunidad" as const })),
        ...popularidad
          .filter((candidato) => !enComunidad.has(candidato.id))
          .map((candidato) => ({ candidato, origen: "popularidad" as const })),
      ];

      const elegibles = candidatos.filter(
        ({ candidato }) =>
          !excluidos.has(candidato.id) && (!query.tipo || candidato.tipo === query.tipo),
      );

      // Priorizar intereses sin alterar el orden del ranking dentro de cada bloque.
      const conInteres = elegibles.filter(({ candidato }) =>
        candidato.generoIds.some((id) => generosDeInteres.has(id)),
      );
      const resto = elegibles.filter(
        ({ candidato }) => !candidato.generoIds.some((id) => generosDeInteres.has(id)),
      );
      const ordenados = [...conInteres, ...resto];

      const { limit, offset } = paginar(query);
      return {
        items: ordenados.slice(offset, offset + limit).map(({ candidato, origen }) => ({
          id: candidato.id,
          tipo: candidato.tipo,
          titulo: candidato.titulo,
          anio: candidato.anio,
          posterUrl: candidato.posterUrl,
          promedio: candidato.promedio,
          calificaciones: candidato.calificaciones,
          generos: candidato.generos,
          origen,
        })) satisfies RecomendacionComunidad[],
        page: query.page,
        pageSize: query.pageSize,
        total: ordenados.length,
      };
    },
  };
}

export type ServicioComunidad = ReturnType<typeof crearServicioComunidad>;
