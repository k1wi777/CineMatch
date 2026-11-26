import type pg from "pg";
import type { Logger } from "pino";
import { withTransaction } from "../../lib/db.js";
import { ProveedorExternoError } from "../../lib/errors.js";
import type { ContenidoExterno, MovieProvider, TipoContenido } from "./proveedor/movie-provider.js";

// Límites de las columnas de `contenido` y `genero` (migraciones de BE-1.3).
const MAX_ID_EXTERNO = 50;
const MAX_TITULO = 255;
const MAX_DIRECTOR = 150;
const MAX_POSTER = 255;
const MAX_NOMBRE_GENERO = 50;
const TAMANO_LOTE_DETALLES = 20;

export type ResumenTitulos = {
  agregados: number;
  actualizados: number;
  descartados: number;
};

export type ResultadoSincronizacion = ResumenTitulos & {
  generosAgregados: number;
  estado: "ok" | "error";
  // Mensaje seguro para registrar o mostrar. Nunca incluye detalles de la API externa.
  error?: string;
};

export type DependenciasSincronizacion = {
  pool: pg.Pool;
  proveedor: MovieProvider;
  logger: Logger;
};

const TIPOS: TipoContenido[] = ["pelicula", "serie"];

function recortar(valor: string | null, maximo: number): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio.slice(0, maximo);
}

// Un registro es válido si tiene tipo, id externo y título. Lo demás se completa o se deja vacío.
export function esValido(contenido: ContenidoExterno): boolean {
  return (
    (TIPOS as string[]).includes(contenido.tipo) &&
    contenido.idExterno.trim().length > 0 &&
    contenido.idExterno.trim().length <= MAX_ID_EXTERNO &&
    contenido.titulo.trim().length > 0
  );
}

// Nombres de géneros sin repetir y dentro del límite de la columna.
function normalizarGeneros(nombres: string[]): string[] {
  const limpios = nombres
    .map((nombre) => nombre.trim().slice(0, MAX_NOMBRE_GENERO))
    .filter((nombre) => nombre.length > 0);
  return [...new Set(limpios)];
}

async function asignarGeneros(
  tx: pg.PoolClient,
  contenidoId: number,
  nombres: string[],
): Promise<void> {
  await tx.query("DELETE FROM contenido_genero WHERE contenido_id = $1", [contenidoId]);
  if (nombres.length === 0) return;
  // Los géneros que falten se crean; los que existen se reutilizan por nombre (único).
  await tx.query(
    "INSERT INTO genero (nombre) SELECT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING",
    [nombres],
  );
  await tx.query(
    `INSERT INTO contenido_genero (contenido_id, genero_id)
     SELECT $1, g.id FROM genero g WHERE g.nombre = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [contenidoId, nombres],
  );
}

// Crea o actualiza un título por (fuente, tipo, id_externo). Devuelve si se creó o solo se actualizó.
async function guardarTitulo(
  pool: pg.Pool,
  fuente: string,
  contenido: ContenidoExterno,
): Promise<"agregado" | "actualizado" | "descartado"> {
  if (!esValido(contenido)) return "descartado";

  return withTransaction(pool, async (tx) => {
    const { rows } = await tx.query<{ id: number; agregado: boolean }>(
      `INSERT INTO contenido
         (tipo, titulo, sinopsis, anio, director, duracion, poster_url, fondo_url,
          fuente, id_externo, fecha_actualizacion, popularidad_externa)
       VALUES ($1::tipo_contenido, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11)
       ON CONFLICT (fuente, tipo, id_externo) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         sinopsis = EXCLUDED.sinopsis,
         anio = EXCLUDED.anio,
         director = EXCLUDED.director,
         duracion = EXCLUDED.duracion,
         poster_url = EXCLUDED.poster_url,
         fondo_url = EXCLUDED.fondo_url,
         popularidad_externa = EXCLUDED.popularidad_externa,
         fecha_actualizacion = now()
       RETURNING id, (xmax = 0) AS agregado`,
      [
        contenido.tipo,
        recortar(contenido.titulo, MAX_TITULO),
        contenido.sinopsis,
        contenido.anio,
        recortar(contenido.director, MAX_DIRECTOR),
        contenido.duracion,
        recortar(contenido.posterUrl, MAX_POSTER),
        recortar(contenido.fondoUrl ?? null, MAX_POSTER),
        fuente,
        contenido.idExterno.trim(),
        contenido.popularidadExterna,
      ],
    );
    const fila = rows[0];
    if (!fila) {
      throw new Error("La inserción del título no devolvió fila");
    }
    await asignarGeneros(tx, fila.id, normalizarGeneros(contenido.generos));
    return fila.agregado ? "agregado" : "actualizado";
  });
}

// Sincronización del catálogo desde el proveedor (BE-6.2). Es idempotente: repetirla no duplica nada.
// Si el proveedor falla, se devuelve un resultado de error; lo ya guardado se conserva.
export function crearServicioSincronizacion({
  pool,
  proveedor,
  logger,
}: DependenciasSincronizacion) {
  async function sincronizarGeneros(): Promise<number> {
    const nombres = normalizarGeneros(await proveedor.fetchGenres());
    if (nombres.length === 0) return 0;
    const { rowCount } = await pool.query(
      "INSERT INTO genero (nombre) SELECT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING",
      [nombres],
    );
    return rowCount ?? 0;
  }

  return {
    // Carga géneros y, por cada tipo, hasta `cantidadPorTipo` títulos populares con su ficha completa.
    async sincronizar(cantidadPorTipo: number): Promise<ResultadoSincronizacion> {
      const resultado: ResultadoSincronizacion = {
        agregados: 0,
        actualizados: 0,
        descartados: 0,
        generosAgregados: 0,
        estado: "ok",
      };

      const registrar = (estado: "agregado" | "actualizado" | "descartado") => {
        if (estado === "agregado") resultado.agregados += 1;
        else if (estado === "actualizado") resultado.actualizados += 1;
        else resultado.descartados += 1;
      };

      try {
        resultado.generosAgregados = await sincronizarGeneros();

        for (const tipo of TIPOS) {
          let procesados = 0;
          for (let pagina = 1; procesados < cantidadPorTipo; pagina++) {
            const populares = await proveedor.fetchPopular(tipo, pagina);
            if (populares.length === 0) break;

            for (
              let i = 0;
              i < populares.length && procesados < cantidadPorTipo;
              i += TAMANO_LOTE_DETALLES
            ) {
              const lote = populares.slice(i, i + TAMANO_LOTE_DETALLES);
              // La ficha completa trae director y duración; si el proveedor no la tiene, vale el dato de la lista.
              const fichas = await Promise.all(
                lote.map((popular) =>
                  proveedor.fetchDetails(tipo, popular.idExterno).then((ficha) => ficha ?? popular),
                ),
              );
              for (const ficha of fichas) {
                if (procesados >= cantidadPorTipo) break;
                procesados += 1;
                registrar(await guardarTitulo(pool, proveedor.fuente, ficha));
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!(err instanceof ProveedorExternoError)) throw err;
        logger.error(
          { fuente: proveedor.fuente },
          "Sincronización del catálogo interrumpida: proveedor no disponible",
        );
        resultado.estado = "error";
        resultado.error = err.message;
      }

      return resultado;
    },
  };
}

export type ServicioSincronizacion = ReturnType<typeof crearServicioSincronizacion>;
