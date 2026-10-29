import type {
  BibliotecaQuery,
  ConteosBiblioteca,
  ElementoBiblioteca,
  EstadoBiblioteca,
  GeneroRef,
  PaginaBiblioteca,
  TipoContenido,
} from "@cinematch/shared";
import type pg from "pg";
import { NotFoundError } from "../../lib/errors.js";
import { paginar } from "../../lib/pagination.js";

export type SeguimientoTitulo = {
  contenidoId: number;
  estado: EstadoBiblioteca;
  fechaActualizacion: string;
};

type FilaElemento = {
  id: number;
  tipo: TipoContenido;
  titulo: string;
  anio: number | null;
  poster_url: string | null;
  estado: EstadoBiblioteca;
  fecha_actualizacion: Date;
};

// Dirección y columna de orden se traducen a literales SQL: nunca se interpola la entrada del cliente.
const ORDEN_SQL = {
  fecha: "s.fecha_actualizacion",
  titulo: "lower(c.titulo)",
} as const;

// Biblioteca personal de cada usuario (BE-8.1 y BE-8.2). Siempre filtra por la sesión.
export function crearServicioBiblioteca(pool: pg.Pool) {
  return {
    // Crea o cambia el estado del título para el usuario. Repetirlo con el mismo estado solo renueva la fecha.
    async establecerEstado(
      usuarioId: number,
      contenidoId: number,
      estado: EstadoBiblioteca,
    ): Promise<SeguimientoTitulo> {
      const { rows: titulo } = await pool.query("SELECT 1 FROM contenido WHERE id = $1", [
        contenidoId,
      ]);
      if (titulo.length === 0) {
        throw new NotFoundError("El título no existe.");
      }
      const { rows } = await pool.query<{ estado: EstadoBiblioteca; fecha_actualizacion: Date }>(
        `INSERT INTO seguimiento (usuario_id, contenido_id, estado, fecha_actualizacion)
         VALUES ($1, $2, $3::estado_biblioteca, now())
         ON CONFLICT (usuario_id, contenido_id) DO UPDATE
           SET estado = EXCLUDED.estado, fecha_actualizacion = now()
         RETURNING estado, fecha_actualizacion`,
        [usuarioId, contenidoId, estado],
      );
      const fila = rows[0];
      if (!fila) {
        throw new Error("El upsert de seguimiento no devolvió fila");
      }
      return {
        contenidoId,
        estado: fila.estado,
        fechaActualizacion: fila.fecha_actualizacion.toISOString(),
      };
    },

    // Estado del título para la sesión, o null si no está en la biblioteca.
    async estadoDe(usuarioId: number, contenidoId: number): Promise<EstadoBiblioteca | null> {
      const { rows } = await pool.query<{ estado: EstadoBiblioteca }>(
        "SELECT estado FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2",
        [usuarioId, contenidoId],
      );
      return rows[0]?.estado ?? null;
    },

    // Quita el título de la biblioteca. Es idempotente: si no estaba, no pasa nada.
    async quitar(usuarioId: number, contenidoId: number): Promise<void> {
      await pool.query("DELETE FROM seguimiento WHERE usuario_id = $1 AND contenido_id = $2", [
        usuarioId,
        contenidoId,
      ]);
    },

    async listar(usuarioId: number, query: BibliotecaQuery): Promise<PaginaBiblioteca> {
      const condiciones: string[] = [];
      const valores: unknown[] = [usuarioId];
      const agregar = (sql: string, valor: unknown) => {
        valores.push(valor);
        condiciones.push(sql.replace("?", `$${valores.length}`));
      };
      if (query.tipo) agregar("c.tipo = ?::tipo_contenido", query.tipo);
      if (query.generoIds && query.generoIds.length > 0) {
        agregar(
          "EXISTS (SELECT 1 FROM contenido_genero cg WHERE cg.contenido_id = c.id AND cg.genero_id = ANY(?::int[]))",
          query.generoIds,
        );
      }
      const condicionesSinEstado =
        condiciones.length > 0 ? ` AND ${condiciones.join(" AND ")}` : "";
      const desde = `FROM seguimiento s JOIN contenido c ON c.id = s.contenido_id WHERE s.usuario_id = $1${condicionesSinEstado}`;

      // Conteos por pestaña: tipo y géneros sí, estado no (así cada pestaña muestra cuántos tiene).
      const { rows: porEstado } = await pool.query<{ estado: EstadoBiblioteca; total: string }>(
        `SELECT s.estado, count(*) AS total ${desde} GROUP BY s.estado`,
        valores,
      );
      const conteos: ConteosBiblioteca = {
        pendiente: 0,
        viendo: 0,
        vista: 0,
        abandonada: 0,
        total: 0,
      };
      for (const fila of porEstado) {
        conteos[fila.estado] = Number(fila.total);
        conteos.total += Number(fila.total);
      }

      const condicionEstado = query.estado
        ? ` AND s.estado = $${valores.length + 1}::estado_biblioteca`
        : "";
      const valoresPagina = query.estado ? [...valores, query.estado] : [...valores];
      const direccion = query.dir === "asc" ? "ASC" : "DESC";
      const orden = `${ORDEN_SQL[query.orden]} ${direccion}, s.contenido_id ${direccion}`;
      const { limit, offset } = paginar(query);
      const n = valoresPagina.length;

      const [pagina, total] = await Promise.all([
        pool.query<FilaElemento>(
          `SELECT c.id, c.tipo, c.titulo, c.anio, c.poster_url, s.estado, s.fecha_actualizacion
             ${desde}${condicionEstado}
            ORDER BY ${orden}
            LIMIT $${n + 1} OFFSET $${n + 2}`,
          [...valoresPagina, limit, offset],
        ),
        pool.query<{ total: string }>(
          `SELECT count(*) AS total ${desde}${condicionEstado}`,
          valoresPagina,
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
          estado: fila.estado,
          fechaActualizacion: fila.fecha_actualizacion.toISOString(),
        })) satisfies ElementoBiblioteca[],
        page: query.page,
        pageSize: query.pageSize,
        total: Number(total.rows[0]?.total ?? 0),
        conteos,
      };
    },
  };
}

async function generosDe(pool: pg.Pool, contenidoIds: number[]): Promise<Map<number, GeneroRef[]>> {
  const mapa = new Map<number, GeneroRef[]>();
  if (contenidoIds.length === 0) return mapa;
  const { rows } = await pool.query<{ contenido_id: number; id: number; nombre: string }>(
    `SELECT cg.contenido_id, g.id, g.nombre
       FROM contenido_genero cg JOIN genero g ON g.id = cg.genero_id
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

export type ServicioBiblioteca = ReturnType<typeof crearServicioBiblioteca>;
