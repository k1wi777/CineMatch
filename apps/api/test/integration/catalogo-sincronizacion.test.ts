import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { ProveedorExternoError } from "../../src/lib/errors.js";
import { crearServicioSincronizacion } from "../../src/modules/catalogo/sincronizacion.js";
import type {
  ContenidoExterno,
  MovieProvider,
  TipoContenido,
} from "../../src/modules/catalogo/proveedor/movie-provider.js";

const SILENCIO = { error: () => undefined, info: () => undefined } as unknown as Parameters<
  typeof crearServicioSincronizacion
>[0]["logger"];

function titulo(
  tipo: TipoContenido,
  id: string,
  generos: string[],
  extra: Partial<ContenidoExterno> = {},
) {
  return {
    tipo,
    idExterno: id,
    titulo: `Título ${tipo} ${id}`,
    sinopsis: null,
    anio: 2020,
    director: null,
    duracion: 100,
    posterUrl: null,
    popularidadExterna: 10,
    generos,
    ...extra,
  } satisfies ContenidoExterno;
}

// Proveedor falso con datos controlados. `fallo` hace que falle la lista popular a partir de una página.
function proveedorFalso(opciones: {
  fuente?: string;
  peliculas?: ContenidoExterno[];
  series?: ContenidoExterno[];
  generos?: string[];
  fallaEnPagina?: number;
}): MovieProvider {
  return {
    fuente: opciones.fuente ?? "prueba",
    async fetchGenres() {
      return opciones.generos ?? ["Drama", "Comedia"];
    },
    async fetchPopular(tipo, pagina) {
      if (opciones.fallaEnPagina !== undefined && pagina >= opciones.fallaEnPagina) {
        throw new ProveedorExternoError();
      }
      if (pagina > 1) return [];
      return tipo === "pelicula" ? (opciones.peliculas ?? []) : (opciones.series ?? []);
    },
    async fetchDetails(tipo, id) {
      const lista = tipo === "pelicula" ? (opciones.peliculas ?? []) : (opciones.series ?? []);
      return lista.find((c) => c.idExterno === id) ?? null;
    },
  };
}

describe("sincronización del catálogo (BE-6.2)", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function contar(tabla: string): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM ${tabla}`);
    return Number(rows[0]?.total);
  }

  it("crea títulos y géneros, y repetir la sincronización no duplica nada", async () => {
    const proveedor = proveedorFalso({
      peliculas: [titulo("pelicula", "1", ["Drama"]), titulo("pelicula", "2", ["Comedia"])],
      series: [titulo("serie", "10", ["Drama", "Comedia"])],
    });
    const servicio = crearServicioSincronizacion({ pool, proveedor, logger: SILENCIO });

    const primera = await servicio.sincronizar(2);
    const contenidoTras1 = await contar("contenido");
    const generosTras1 = await contar("genero");
    const segunda = await servicio.sincronizar(2);

    expect(primera).toMatchObject({ estado: "ok", agregados: 3, actualizados: 0, descartados: 0 });
    expect(segunda).toMatchObject({ estado: "ok", agregados: 0, actualizados: 3, descartados: 0 });
    expect(await contar("contenido")).toBe(contenidoTras1);
    expect(await contar("genero")).toBe(generosTras1);
  });

  it("descarta los registros inválidos y los cuenta", async () => {
    const proveedor = proveedorFalso({
      peliculas: [
        titulo("pelicula", "1", ["Drama"]),
        titulo("pelicula", "2", ["Drama"], { titulo: "   " }),
        titulo("pelicula", "", ["Drama"]),
      ],
      series: [titulo("serie", "10", ["Comedia"])],
    });
    const servicio = crearServicioSincronizacion({ pool, proveedor, logger: SILENCIO });

    const resultado = await servicio.sincronizar(3);

    expect(resultado).toMatchObject({ agregados: 2, descartados: 2 });
    expect(await contar("contenido")).toBe(2);
  });

  it("actualiza los géneros de un título cuando cambian en el proveedor", async () => {
    const antes = proveedorFalso({ peliculas: [titulo("pelicula", "1", ["Drama"])] });
    const despues = proveedorFalso({ peliculas: [titulo("pelicula", "1", ["Comedia"])] });
    await crearServicioSincronizacion({ pool, proveedor: antes, logger: SILENCIO }).sincronizar(1);

    await crearServicioSincronizacion({ pool, proveedor: despues, logger: SILENCIO }).sincronizar(
      1,
    );

    const { rows } = await pool.query<{ nombre: string }>(
      `SELECT g.nombre FROM contenido_genero cg JOIN genero g ON g.id = cg.genero_id`,
    );
    expect(rows.map((fila) => fila.nombre)).toEqual(["Comedia"]);
  });

  it("actualiza fecha_actualizacion en cada sincronización", async () => {
    const proveedor = proveedorFalso({ peliculas: [titulo("pelicula", "1", ["Drama"])] });
    const servicio = crearServicioSincronizacion({ pool, proveedor, logger: SILENCIO });
    await servicio.sincronizar(1);
    await pool.query("UPDATE contenido SET fecha_actualizacion = '2000-01-01T00:00:00Z'");

    await servicio.sincronizar(1);

    const { rows } = await pool.query<{ antigua: boolean }>(
      "SELECT fecha_actualizacion < '2001-01-01T00:00:00Z' AS antigua FROM contenido",
    );
    expect(rows[0]?.antigua).toBe(false);
  });

  it("si el proveedor falla, devuelve error y conserva el catálogo existente", async () => {
    const buena = proveedorFalso({
      peliculas: [titulo("pelicula", "1", ["Drama"]), titulo("pelicula", "2", ["Drama"])],
    });
    await crearServicioSincronizacion({ pool, proveedor: buena, logger: SILENCIO }).sincronizar(2);
    const caida = proveedorFalso({ peliculas: [], fallaEnPagina: 1 });

    const resultado = await crearServicioSincronizacion({
      pool,
      proveedor: caida,
      logger: SILENCIO,
    }).sincronizar(2);

    expect(resultado.estado).toBe("error");
    expect(resultado.error).toBeDefined();
    expect(await contar("contenido")).toBe(2);
  });

  it("dos fuentes con el mismo id externo no se mezclan", async () => {
    const tmdbLike = proveedorFalso({
      fuente: "tmdb",
      peliculas: [titulo("pelicula", "7", ["Drama"])],
    });
    const otra = proveedorFalso({
      fuente: "otra",
      peliculas: [titulo("pelicula", "7", ["Drama"])],
    });

    await crearServicioSincronizacion({ pool, proveedor: tmdbLike, logger: SILENCIO }).sincronizar(
      1,
    );
    await crearServicioSincronizacion({ pool, proveedor: otra, logger: SILENCIO }).sincronizar(1);

    expect(await contar("contenido")).toBe(2);
  });

  it("con el proveedor de prueba carga la cantidad pedida y es idempotente", async () => {
    const { crearMockProvider } =
      await import("../../src/modules/catalogo/proveedor/mock-provider.js");
    const servicio = crearServicioSincronizacion({
      pool,
      proveedor: crearMockProvider(),
      logger: SILENCIO,
    });

    const primera = await servicio.sincronizar(5);
    const segunda = await servicio.sincronizar(5);

    expect(primera).toMatchObject({ estado: "ok", agregados: 10 });
    expect(segunda).toMatchObject({ estado: "ok", agregados: 0, actualizados: 10 });
    expect(await contar("contenido")).toBe(10);
  });
});
