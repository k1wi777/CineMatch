import type {
  CatalogoItem,
  CatalogoQuery,
  Destacado,
  GeneroRef,
  TituloFicha,
  TipoContenido,
  Logo,
  Region,
  Trailer,
} from "@cinematch/shared";
import type pg from "pg";
import { paginar } from "../../lib/pagination.js";
import type { ContenidoExterno, MovieProvider } from "./proveedor/movie-provider.js";
import { guardarTitulo } from "./sincronizacion.js";

const DIA_MS = 24 * 60 * 60 * 1000;
// Un enlace de tráiler se considera fresco durante 30 días antes de volver a consultarlo.
const TTL_TRAILER_DIAS = 30;

type FilaDestacado = {
  id: number;
  tipo: TipoContenido;
  titulo: string;
  anio: number | null;
  sinopsis: string | null;
  poster_url: string | null;
  fondo_url: string;
  fuente: string;
  id_externo: string;
  logo_url: string | null;
  logo_consultado_en: Date | null;
  trailer_url: string | null;
  trailer_consultado_en: Date | null;
};

// Títulos que se revisan para armar el carrusel (de ellos se quedan los que tienen tráiler).
const CANDIDATOS_DESTACADOS = 24;

type FilaLogo = {
  tipo: TipoContenido;
  id_externo: string;
  fuente: string;
  logo_url: string | null;
  logo_consultado_en: Date | null;
};

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
  galeria: string[] | null;
  galeria_consultado_en: Date | null;
  fuente: string;
  id_externo: string;
  reparto: string[] | null;
  reparto_consultado_en: Date | null;
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
  // Logotipos de los destacados: los guardados y vigentes se usan tal cual; el resto se pide a la fuente
  // (solo títulos de esa fuente) y se guarda, así cada título se consulta como mucho cada TTL_TRAILER_DIAS.
  async function logosDe(filas: FilaDestacado[]): Promise<Map<number, string | null>> {
    const mapa = new Map<number, string | null>();
    const ahora = Date.now();
    for (const fila of filas) {
      const vigente =
        fila.logo_consultado_en !== null &&
        ahora - fila.logo_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
      if (vigente || fila.fuente !== proveedor.fuente) {
        mapa.set(fila.id, fila.logo_url);
        continue;
      }
      const url = await proveedor.fetchLogo(fila.tipo, fila.id_externo);
      await pool.query(
        "UPDATE contenido SET logo_url = $2, logo_consultado_en = now() WHERE id = $1",
        [fila.id, url],
      );
      mapa.set(fila.id, url);
    }
    return mapa;
  }

  // Galería de un título: igual que el reparto, se consulta una vez y queda guardada.
  async function galeriaDe(fila: FilaFicha): Promise<string[]> {
    const vigente =
      fila.galeria_consultado_en !== null &&
      Date.now() - fila.galeria_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
    if (vigente || fila.fuente !== proveedor.fuente) return fila.galeria ?? [];
    try {
      const lista = await proveedor.fetchGallery(fila.tipo, fila.id_externo);
      await pool.query(
        "UPDATE contenido SET galeria = $2::jsonb, galeria_consultado_en = now() WHERE id = $1",
        [fila.id, JSON.stringify(lista)],
      );
      return lista;
    } catch {
      return fila.galeria ?? [];
    }
  }

  // Reparto de un título: el guardado si sigue vigente; si no, se consulta a la fuente y se guarda.
  // Si la fuente falla, la ficha se muestra sin reparto en lugar de fallar.
  async function repartoDe(fila: FilaFicha): Promise<string[]> {
    const vigente =
      fila.reparto_consultado_en !== null &&
      Date.now() - fila.reparto_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
    if (vigente || fila.fuente !== proveedor.fuente) return fila.reparto ?? [];
    try {
      const lista = await proveedor.fetchCast(fila.tipo, fila.id_externo);
      await pool.query(
        "UPDATE contenido SET reparto = $2::jsonb, reparto_consultado_en = now() WHERE id = $1",
        [fila.id, JSON.stringify(lista)],
      );
      return lista;
    } catch {
      return fila.reparto ?? [];
    }
  }

  // Tráiler de un título: el guardado si sigue vigente; si no, se consulta a la fuente y se guarda.
  async function trailerDe(fila: FilaDestacado): Promise<string | null> {
    const vigente =
      fila.trailer_consultado_en !== null &&
      Date.now() - fila.trailer_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
    if (vigente || fila.fuente !== proveedor.fuente) return fila.trailer_url;
    const url = await proveedor.fetchTrailer(fila.tipo, fila.id_externo);
    await pool.query(
      "UPDATE contenido SET trailer_url = $2, trailer_consultado_en = now() WHERE id = $1",
      [fila.id, url],
    );
    return url;
  }

  // Puntuación de TMDB (0 a 10) de los destacados, en estrellas (0 a 5). Solo se usa en el carrusel:
  // se pide a TMDB en directo y se guarda en memoria seis horas, sin tocar la base de datos.
  const TTL_PUNTUACION_MS = 6 * 60 * 60 * 1000;
  const puntuacionCache = new Map<string, { en: number; estrellas: number | null }>();

  async function puntuacionesDe(filas: FilaDestacado[]): Promise<Map<number, number | null>> {
    const mapa = new Map<number, number | null>();
    for (const fila of filas) {
      const clave = `${fila.tipo}:${fila.id_externo}`;
      const guardada = puntuacionCache.get(clave);
      if (guardada && Date.now() - guardada.en < TTL_PUNTUACION_MS) {
        mapa.set(fila.id, guardada.estrellas);
        continue;
      }
      let estrellas: number | null = null;
      if (proveedor.fetchPuntuacion) {
        try {
          const puntuacion = await proveedor.fetchPuntuacion(fila.tipo, fila.id_externo);
          if (puntuacion !== null) {
            // Medio punto más cercano: 7.3 de 10 pasa a 3.5 de 5.
            estrellas = Math.round((puntuacion / 2) * 2) / 2;
          }
        } catch {
          // Sin puntuación, la estrella se muestra vacía.
        }
      }
      puntuacionCache.set(clave, { en: Date.now(), estrellas });
      mapa.set(fila.id, estrellas);
    }
    return mapa;
  }

  // Textos ya buscados en la fuente externa (clave: texto normalizado, valor: momento de la búsqueda).
  const busquedasRecientes = new Map<string, number>();
  const TTL_BUSQUEDA_MS = DIA_MS;

  // Títulos que CineMatch sugiere: van primero en el carrusel, en este orden (ids externos de TMDB).
  const SUGERENCIAS_EXTERNAS = ["687163", "969681", "1368337", "1084242", "83533", "967941"];
  let sugerenciasCache: number[] | undefined;

  // Ids locales de las sugerencias. Si no están en el catálogo, se piden a la fuente y se guardan.
  async function sugerenciasIds(): Promise<number[]> {
    if (sugerenciasCache) return sugerenciasCache;
    const buscar = () =>
      pool.query<{ id: number; id_externo: string }>(
        `SELECT id, id_externo FROM contenido
          WHERE fuente = $1 AND tipo = 'pelicula' AND id_externo = ANY($2::text[])`,
        [proveedor.fuente, SUGERENCIAS_EXTERNAS],
      );
    let { rows } = await buscar();
    const faltan = SUGERENCIAS_EXTERNAS.filter(
      (externo) => !rows.some((f) => f.id_externo === externo),
    );
    if (faltan.length > 0) {
      for (const externo of faltan) {
        try {
          const ficha = await proveedor.fetchDetails("pelicula", externo);
          if (ficha) await guardarTitulo(pool, proveedor.fuente, ficha);
        } catch {
          // Una sugerencia que falla no detiene las demás.
        }
      }
      ({ rows } = await buscar());
    }
    const ids = SUGERENCIAS_EXTERNAS.map(
      (externo) => rows.find((f) => f.id_externo === externo)?.id,
    ).filter((id): id is number => id !== undefined);
    if (ids.length === SUGERENCIAS_EXTERNAS.length) sugerenciasCache = ids;
    return ids;
  }

  // Ids locales de los más populares de cada región, en orden. Se piden a la fuente como mucho cada hora por región.
  const latamCache = new Map<Region, { en: number; ids: number[] }>();
  const TTL_LATAM_MS = 60 * 60 * 1000;

  // Guarda los títulos populares de la región y devuelve sus ids locales en el mismo orden.
  // Si la fuente no lo ofrece o falla, devuelve undefined y el carrusel usa los populares del catálogo.
  async function latamIds(region: Region): Promise<number[] | undefined> {
    if (!proveedor.fetchPopularEnRegion) return undefined;
    const guardado = latamCache.get(region);
    if (guardado && Date.now() - guardado.en < TTL_LATAM_MS) return guardado.ids;
    let lista: ContenidoExterno[];
    try {
      lista = await proveedor.fetchPopularEnRegion(region);
    } catch {
      return undefined;
    }
    for (const contenido of lista) {
      try {
        await guardarTitulo(pool, proveedor.fuente, contenido);
      } catch {
        // Un título que falla no detiene el resto.
      }
    }
    const { rows } = await pool.query<{ id: number; tipo: TipoContenido; id_externo: string }>(
      "SELECT id, tipo, id_externo FROM contenido WHERE fuente = $1 AND id_externo = ANY($2::text[])",
      [proveedor.fuente, lista.map((contenido) => contenido.idExterno)],
    );
    const porClave = new Map(rows.map((fila) => [`${fila.tipo}:${fila.id_externo}`, fila.id]));
    const ids = lista
      .map((contenido) => porClave.get(`${contenido.tipo}:${contenido.idExterno}`))
      .filter((id): id is number => id !== undefined);
    if (ids.length === 0) return undefined;
    latamCache.set(region, { en: Date.now(), ids });
    return ids;
  }

  return {
    // Búsqueda externa: trae los títulos que coinciden con el texto y los guarda en el catálogo.
    // Si la fuente falla, no se guarda nada y la búsqueda local sigue siendo la respuesta.
    // Cada texto se consulta en la fuente como mucho una vez al día.
    async importarBusqueda(texto: string): Promise<number> {
      const clave = normalizarBusqueda(texto);
      const ultima = busquedasRecientes.get(clave);
      if (ultima !== undefined && Date.now() - ultima < TTL_BUSQUEDA_MS) return 0;
      let encontrados: ContenidoExterno[];
      try {
        encontrados = await proveedor.search(texto);
      } catch {
        return 0;
      }
      busquedasRecientes.set(clave, Date.now());
      let guardados = 0;
      for (const contenido of encontrados) {
        try {
          const resultado = await guardarTitulo(pool, proveedor.fuente, contenido);
          if (resultado !== "descartado") guardados += 1;
        } catch {
          // Un título que falla no detiene el resto.
        }
      }
      return guardados;
    },

    // Logotipo de un título: el guardado si sigue vigente; si no, se consulta a la fuente y se guarda.
    async obtenerLogo(id: number): Promise<Logo | undefined> {
      const { rows } = await pool.query<FilaLogo>(
        `SELECT tipo, id_externo, fuente, logo_url, logo_consultado_en FROM contenido WHERE id = $1`,
        [id],
      );
      const fila = rows[0];
      if (!fila) return undefined;
      const vigente =
        fila.logo_consultado_en !== null &&
        Date.now() - fila.logo_consultado_en.getTime() < TTL_TRAILER_DIAS * DIA_MS;
      if (vigente || fila.fuente !== proveedor.fuente) return { url: fila.logo_url };
      const url = await proveedor.fetchLogo(fila.tipo, fila.id_externo);
      await pool.query(
        "UPDATE contenido SET logo_url = $2, logo_consultado_en = now() WHERE id = $1",
        [id, url],
      );
      return { url };
    },

    // Marca el tráiler de un título como no reproducible (p. ej. YouTube no permite incrustarlo).
    // Queda sin enlace y no se vuelve a pedir durante TTL_TRAILER_DIAS, así el carrusel lo descarta.
    async marcarTrailerNoDisponible(id: number): Promise<void> {
      await pool.query(
        "UPDATE contenido SET trailer_url = NULL, trailer_consultado_en = now() WHERE id = $1",
        [id],
      );
    },

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
        pool.query<FilaTitulo & { fondo_url: string | null }>(
          `SELECT c.id, c.tipo, c.titulo, c.anio, c.poster_url, c.fondo_url
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
          fondoUrl: fila.fondo_url,
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
                popularidad_externa, fecha_actualizacion, fuente, id_externo, reparto,
                reparto_consultado_en, galeria, galeria_consultado_en
           FROM contenido
          WHERE id = $1`,
        [id],
      );
      const fila = rows[0];
      if (!fila) return undefined;
      const generos = await generosDe(pool, [id]);
      const reparto = await repartoDe(fila);
      const galeria = await galeriaDe(fila);
      return {
        id: fila.id,
        reparto,
        galeria,
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

    // Títulos del carrusel del inicio: los más populares que tienen imagen horizontal.
    async destacados(limite: number, region: Region): Promise<Destacado[]> {
      // Primero las sugerencias de CineMatch (siempre, aunque no tengan tráiler).
      // Después los destacados del país: los que tienen tráiler, o los candidatos con póster si ninguno tiene.
      const sugeridos = await sugerenciasIds();
      const ids = await latamIds(region);
      const { rows: candidatas } = ids
        ? await pool.query<FilaDestacado>(
            `SELECT id, tipo, titulo, anio, sinopsis, poster_url, fondo_url, fuente, id_externo,
                    logo_url, logo_consultado_en, trailer_url, trailer_consultado_en
               FROM contenido
              WHERE id = ANY($1::int[]) AND fondo_url IS NOT NULL`,
            [ids],
          )
        : await pool.query<FilaDestacado>(
            `SELECT id, tipo, titulo, anio, sinopsis, poster_url, fondo_url, fuente, id_externo,
                    logo_url, logo_consultado_en, trailer_url, trailer_consultado_en
               FROM contenido
              WHERE fondo_url IS NOT NULL
              ORDER BY popularidad_externa DESC NULLS LAST, id
              LIMIT $1`,
            [CANDIDATOS_DESTACADOS],
          );
      if (ids) {
        // La consulta no garantiza el orden de popularidad: se restaura.
        candidatas.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      }

      const { rows: filasSugeridas } = await pool.query<FilaDestacado>(
        `SELECT id, tipo, titulo, anio, sinopsis, poster_url, fondo_url, fuente, id_externo,
                logo_url, logo_consultado_en, trailer_url, trailer_consultado_en
           FROM contenido WHERE id = ANY($1::int[])`,
        [sugeridos],
      );
      filasSugeridas.sort((a, b) => sugeridos.indexOf(a.id) - sugeridos.indexOf(b.id));
      const cupoPais = Math.max(0, limite - filasSugeridas.length);
      const resto = candidatas.filter((fila) => !sugeridos.includes(fila.id));

      const elegidosSugeridos: {
        fila: FilaDestacado;
        trailerUrl: string | null;
        sugerencia: boolean;
      }[] = [];
      for (const fila of filasSugeridas) {
        elegidosSugeridos.push({ fila, trailerUrl: await trailerDe(fila), sugerencia: true });
      }

      const conTrailer: { fila: FilaDestacado; trailerUrl: string | null; sugerencia: boolean }[] =
        [];
      for (const fila of resto) {
        if (conTrailer.length >= cupoPais) break;
        const trailerUrl = await trailerDe(fila);
        if (trailerUrl) conTrailer.push({ fila, trailerUrl, sugerencia: false });
      }
      const delPais =
        conTrailer.length > 0
          ? conTrailer
          : resto.slice(0, cupoPais).map((fila) => ({ fila, trailerUrl: null, sugerencia: false }));

      const elegidos = [...elegidosSugeridos, ...delPais];
      const filas = elegidos.map((elegido) => elegido.fila);
      const generos = await generosDe(
        pool,
        filas.map((fila) => fila.id),
      );
      const logos = await logosDe(filas);
      const puntuaciones = await puntuacionesDe(filas);
      return elegidos.map(({ fila, trailerUrl, sugerencia }) => ({
        promedio: puntuaciones.get(fila.id) ?? null,
        id: fila.id,
        tipo: fila.tipo,
        titulo: fila.titulo,
        anio: fila.anio,
        sinopsis: fila.sinopsis,
        posterUrl: fila.poster_url,
        fondoUrl: fila.fondo_url,
        logoUrl: logos.get(fila.id) ?? null,
        trailerUrl,
        generos: generos.get(fila.id) ?? [],
        sugerencia,
      }));
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
