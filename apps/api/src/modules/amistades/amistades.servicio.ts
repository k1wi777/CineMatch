import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type { ServicioCreacion } from "../notificaciones/notificaciones.creacion.js";

export type EstadoAmistad = "pendiente" | "aceptada" | "rechazada";

export type Amistad = {
  id: number;
  estado: EstadoAmistad;
  solicitanteId: number;
  receptorId: number;
  fechaSolicitud: string;
  fechaRespuesta: string | null;
};

type FilaAmistad = {
  id: number;
  estado: EstadoAmistad;
  solicitante_id: number;
  receptor_id: number;
  fecha_solicitud: Date;
  fecha_respuesta: Date | null;
};

const CAMPOS = "id, estado, solicitante_id, receptor_id, fecha_solicitud, fecha_respuesta";

export function aAmistad(fila: FilaAmistad): Amistad {
  return {
    id: fila.id,
    estado: fila.estado,
    solicitanteId: fila.solicitante_id,
    receptorId: fila.receptor_id,
    fechaSolicitud: fila.fecha_solicitud.toISOString(),
    fechaRespuesta: fila.fecha_respuesta?.toISOString() ?? null,
  };
}

export type DependenciasAmistades = {
  pool: pg.Pool;
  creacion: ServicioCreacion;
};

// Red de amigos (BE-7). Cada operación comprueba quién es la sesión y en qué estado está la amistad.
// Hay una sola fila por par de usuarios (índice único amistad_par_key), así que dos solicitudes a la vez
// no pueden crear dos filas: la segunda falla con 409.
export function crearServicioAmistades({ pool, creacion }: DependenciasAmistades) {
  // Bloquea la fila del par para que dos operaciones sobre la misma amistad vayan en serie.
  async function cargarPar(
    tx: pg.PoolClient,
    a: number,
    b: number,
  ): Promise<FilaAmistad | undefined> {
    const { rows } = await tx.query<FilaAmistad>(
      `SELECT ${CAMPOS} FROM amistad
        WHERE LEAST(solicitante_id, receptor_id) = LEAST($1::int, $2::int)
          AND GREATEST(solicitante_id, receptor_id) = GREATEST($1::int, $2::int)
        FOR UPDATE`,
      [a, b],
    );
    return rows[0];
  }

  // Carga una amistad por id, solo si la sesión es una de sus partes. Si no lo es, responde como si no existiera.
  async function cargarParte(tx: pg.PoolClient, id: number, yo: number): Promise<FilaAmistad> {
    const { rows } = await tx.query<FilaAmistad>(
      `SELECT ${CAMPOS} FROM amistad
        WHERE id = $1 AND (solicitante_id = $2 OR receptor_id = $2)
        FOR UPDATE`,
      [id, yo],
    );
    const fila = rows[0];
    if (!fila) throw new NotFoundError("La solicitud o amistad no existe.");
    return fila;
  }

  async function usuarioActivo(tx: pg.PoolClient, id: number): Promise<boolean> {
    const { rows } = await tx.query(
      "SELECT 1 FROM usuario WHERE id = $1 AND eliminado_en IS NULL",
      [id],
    );
    return rows.length > 0;
  }

  return {
    async enviarSolicitud(yo: number, otro: number): Promise<Amistad> {
      if (yo === otro) {
        throw new ValidationError({ usuarioId: "No puedes agregarte a ti mismo." });
      }

      return withTransaction(pool, async (tx) => {
        if (!(await usuarioActivo(tx, otro))) {
          throw new NotFoundError("El usuario no existe.");
        }

        const existente = await cargarPar(tx, yo, otro);
        if (!existente) {
          const { rows } = await tx.query<FilaAmistad>(
            `INSERT INTO amistad (solicitante_id, receptor_id) VALUES ($1, $2) RETURNING ${CAMPOS}`,
            [yo, otro],
          );
          const fila = rows[0] as FilaAmistad;
          await creacion.crear(tx, {
            tipo: "solicitud_amistad",
            destinatarioId: otro,
            origenId: yo,
            referencia: { amistadId: fila.id },
          });
          return aAmistad(fila);
        }

        if (existente.estado === "aceptada") {
          throw new ConflictError("Ya sois amigos.");
        }
        if (existente.estado === "pendiente") {
          throw new ConflictError(
            existente.solicitante_id === yo
              ? "Ya enviaste una solicitud a esta persona."
              : "Esta persona ya te envió una solicitud: acéptala en lugar de enviar otra.",
          );
        }

        // Rechazada: se puede reenviar. La fila vuelve a pendiente con quien la envía ahora como solicitante.
        const { rows } = await tx.query<FilaAmistad>(
          `UPDATE amistad
              SET solicitante_id = $2, receptor_id = $3, estado = 'pendiente',
                  fecha_solicitud = now(), fecha_respuesta = NULL
            WHERE id = $1
            RETURNING ${CAMPOS}`,
          [existente.id, yo, otro],
        );
        const fila = rows[0] as FilaAmistad;
        await creacion.crear(tx, {
          tipo: "solicitud_amistad",
          destinatarioId: otro,
          origenId: yo,
          referencia: { amistadId: fila.id },
        });
        return aAmistad(fila);
      });
    },

    async aceptar(yo: number, id: number): Promise<Amistad> {
      return withTransaction(pool, async (tx) => {
        const fila = await cargarParte(tx, id, yo);
        if (fila.receptor_id !== yo) {
          throw new ForbiddenError("Solo quien recibió la solicitud puede aceptarla.");
        }
        if (fila.estado !== "pendiente") {
          throw new ConflictError("Esta solicitud ya fue respondida.");
        }
        const { rows } = await tx.query<FilaAmistad>(
          `UPDATE amistad SET estado = 'aceptada', fecha_respuesta = now() WHERE id = $1 RETURNING ${CAMPOS}`,
          [id],
        );
        const actualizada = rows[0] as FilaAmistad;
        await creacion.crear(tx, {
          tipo: "amistad_aceptada",
          destinatarioId: actualizada.solicitante_id,
          origenId: yo,
          referencia: { amistadId: id },
        });
        return aAmistad(actualizada);
      });
    },

    async rechazar(yo: number, id: number): Promise<Amistad> {
      return withTransaction(pool, async (tx) => {
        const fila = await cargarParte(tx, id, yo);
        if (fila.receptor_id !== yo) {
          throw new ForbiddenError("Solo quien recibió la solicitud puede rechazarla.");
        }
        if (fila.estado !== "pendiente") {
          throw new ConflictError("Esta solicitud ya fue respondida.");
        }
        const { rows } = await tx.query<FilaAmistad>(
          `UPDATE amistad SET estado = 'rechazada', fecha_respuesta = now() WHERE id = $1 RETURNING ${CAMPOS}`,
          [id],
        );
        return aAmistad(rows[0] as FilaAmistad);
      });
    },

    // Cancelar una solicitud pendiente: solo quien la envió. Elimina la fila para poder volver a enviarla.
    async cancelar(yo: number, id: number): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const fila = await cargarParte(tx, id, yo);
        if (fila.solicitante_id !== yo) {
          throw new ForbiddenError("Solo quien envió la solicitud puede cancelarla.");
        }
        if (fila.estado !== "pendiente") {
          throw new ConflictError("Solo se puede cancelar una solicitud pendiente.");
        }
        await tx.query("DELETE FROM amistad WHERE id = $1", [id]);
      });
    },

    // Eliminar una amistad aceptada: cualquiera de las dos partes. Las reseñas y recomendaciones se conservan.
    async eliminar(yo: number, id: number): Promise<void> {
      await withTransaction(pool, async (tx) => {
        const fila = await cargarParte(tx, id, yo);
        if (fila.estado !== "aceptada") {
          throw new ConflictError("Solo se puede eliminar una amistad aceptada.");
        }
        await tx.query("DELETE FROM amistad WHERE id = $1", [id]);
      });
    },
  };
}

export type ServicioAmistades = ReturnType<typeof crearServicioAmistades>;
