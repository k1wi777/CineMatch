import type {
  CatalogoItem,
  CatalogoQuery,
  GeneroRef,
  TituloFicha,
  TipoContenido,
  Trailer,
} from "@cinematch/shared";
import type pg from "pg";
import { paginar } from "../../lib/pagination.js";
import type { MovieProvider } from "./proveedor/movie-provider.js";

const DIA_MS = 24 * 60 * 60 * 1000;
// Un enlace de tráiler se considera fresco durante 30 días antes de volver a consultarlo.
const TTL_TRAILER_DIAS = 30;

type FilaTrailer = {
  tipo: TipoContenido;
  id_externo: string;
  fuente: string;
  trailer_url: string | null;
  trailer_consultado_en: Date | null;
};

// Mismo criterio que la columna titulo_normalizado (migración de BE-6.4): minúsculas y sin tildes.
const SIN_TILDES: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
};

export function normalizarBusqueda(texto: string): string {
  return texto.toLowerCase().replace(/[áéíóúüñ]/g, (letra) => SIN_TILDES[letra] ?? letra);
}

// En LIKE, % _ y \ tienen significado propio: se escapan para buscar el texto literal.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

type FilaTitulo = {
  id: number;
  tipo: TipoContenido;
  titulo: string;
  anio: number | null;
  poster_url: string | null;
};

type FilaFicha = FilaTitulo & {
  sinopsis: string | null;
  director: string | null;
  duracion: number | null;
  popularidad_externa: string | null;
  fecha_actualizacion: Date;
};

// Géneros de un conjunto de títulos en una sola consulta.
async function generosDe(pool: pg.Pool, contenidoIds: number[]): Promise<Map<number, GeneroRef[]>> {
  const mapa = new Map<number, GeneroRef[]>();
  if (contenidoIds.length === 0) return mapa;
  const { rows } = await pool.query<{ contenido_id: number; id: number; nombre: string }>(
    `SELECT cg.contenido_id, g.id, g.nombre
       FROM contenido_genero cg
       JOIN genero g ON g.id = cg.genero_id
      WHERE cg.contenido_id = ANY($1::int[])
      ORDER BY g.nombre, g.id`,
    [contenidoIds],
  );
  for (const fila of rows) {
    const lista = mapa.get(fila.contenido_id) ?? [];
    lista.push({ id: fila.id, nombre: fila.nombre });
    mapa.set(fila.contenido_id, lista);
  }
  return mapa;
}

// Consulta del catálogo (BE-6.4 y ficha de BE-6.5). Solo lectura.
export function crearServicioCatalogo(pool: pg.Pool, proveedor: MovieProvider) {
  return {
    async listar(
      query: CatalogoQuery,
    ): Promise<{ items: CatalogoItem[]; page: number; pageSize: number; total: number }> {
      const condiciones: string[] = [];
      const valores: unknown[] = [];
      const agregar = (sql: string, valor: unknown) => {
        valores.push(valor);
        condiciones.push(sql.replace("?", `$${valores.length}`));
      };

      const busqueda = query.q ? normalizarBusqueda(query.q) : "";
      if (busqueda) {
        agregar("c.titulo_normalizado LIKE ?", `%${escaparLike(busqueda)}%`);
      }
      if (query.tipo) {
        agregar("c.tipo = ?::tipo_contenido", query.tipo);
      }
      if (query.generoIds && query.generoIds.length > 0) {
        agregar(
          "EXISTS (SELECT 1 FROM contenido_genero cg WHERE cg.contenido_id = c.id AND cg.genero_id = ANY(?::int[]))",
          query.generoIds,
        );
      }
      const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

      const { limit, offset } = paginar(query);
      const [pagina, total] = await Promise.all([
        pool.query<FilaTitulo>(
          `SELECT c.id, c.tipo, c.titulo, c.anio, c.poster_url
             FROM contenido c
             ${where}
            ORDER BY c.popularidad_externa DESC NULLS LAST, c.id ASC
            LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
          [...valores, limit, offset],
        ),
        pool.query<{ total: string }>(
          `SELECT count(*) AS total FROM contenido c ${where}`,
          valores,
        ),
      ]);

      const generos = await generosDe(
        pool,
        pagina.rows.map((fila) => fila.id),
      );
      return {
        items: pagina.rows.map((fila) => ({
          id: fila.id,
          tipo: fila.tipo,
          titulo: fila.titulo,
          anio: fila.anio,
          posterUrl: fila.poster_url,
          generos: generos.get(fila.id) ?? [],
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
      };
    },

    // Ficha base de un título. Devuelve undefined si el id no existe.
    // Las secciones de calificación, etiquetas y reseñas (BE-9.5 y BE-9.6) se añadirán aquí sin cambiar estos campos.
    async obtenerFicha(id: number): Promise<TituloFicha | undefined> {
      const { rows } = await pool.query<FilaFicha>(
        `SELECT id, tipo, titulo, anio, poster_url, sinopsis, director, duracion,
                popularidad_externa, fecha_actualizacion
           FROM contenido
          WHERE id = $1`,
        [id],
      );
      const fila = rows[0];
      if (!fila) return undefined;
      const generos = await generosDe(pool, [id]);
      return {
        id: fila.id,
        tipo: fila.tipo,
        titulo: fila.titulo,
        sinopsis: fila.sinopsis,
        anio: fila.anio,
        director: fila.director,
        duracion: fila.duracion,
        posterUrl: fila.poster_url,
        popularidadExterna:
          fila.popularidad_externa === null ? null : Number(fila.popularidad_externa),
        generos: generos.get(id) ?? [],
        fechaActualizacion: fila.fecha_actualizacion.toISOString(),
      };
    },

    // Enlace al tráiler. Se pide a la fuente externa solo la primera vez y luego se reutiliza
    // durante TTL_TRAILER_DIAS, para no gastar peticiones en cada visita a la ficha.
    async obtenerTrailer(id: number): Promise<Trailer | undefined> {
      const { rows } = await pool.query<FilaTrailer>(
        `SELECT tipo, id_externo, fuente, trailer_url, trailer_consultado_en
           FROM contenido
          WHERE id = $1`,
        [id],
      );
      const fila = rows[0];
      if (!fila) return undefined;

      const vigente =
        fila.trailer_consultado_en !== null &&
        Date.now() - fila.trailer_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
      // Los títulos de otra fuente (p. ej. los de demostración) no se consultan.
      if (vigente || fila.fuente !== proveedor.fuente) {
        return { url: fila.trailer_url };
      }

      const url = await proveedor.fetchTrailer(fila.tipo, fila.id_externo);
      await pool.query(
        "UPDATE contenido SET trailer_url = $2, trailer_consultado_en = now() WHERE id = $1",
        [id, url],
      );
      return { url };
    },
  };
}

export type ServicioCatalogo = ReturnType<typeof crearServicioCatalogo>;
