import type { Registro, RegistroRespuesta } from "@cinematch/shared";
import type pg from "pg";
import { withTransaction } from "../../lib/db.js";
import { ValidationError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { textoPlano } from "../../lib/text.js";

export type DependenciasRegistro = {
  pool: pg.Pool;
  reloj: () => Date;
};

// Crea la cuenta y sus intereses en una sola transacción. No inicia sesión: el front redirige al login.
// La unicidad de correo y username la garantizan los índices; sus violaciones salen como 409 con el campo.
export function crearServicioRegistro({ pool, reloj }: DependenciasRegistro) {
  return {
    async registrar(datos: Registro): Promise<RegistroRespuesta> {
      const hash = await hashPassword(datos.contrasena);
      const nombre = textoPlano(datos.nombre);

      return withTransaction(pool, async (tx) => {
        const { rows: existentes } = await tx.query<{ total: string }>(
          "SELECT count(*) AS total FROM genero WHERE id = ANY($1::int[])",
          [datos.generoIds],
        );
        if (Number(existentes[0]?.total) !== datos.generoIds.length) {
          throw new ValidationError({ generoIds: "Alguno de los géneros elegidos no existe." });
        }

        await tx.query(
          "INSERT INTO rol (nombre) VALUES ('usuario') ON CONFLICT (nombre) DO NOTHING",
        );
        const { rows } = await tx.query<{ id: number }>(
          `INSERT INTO usuario (nombre, username, correo, contrasena, rol_id, acepta_datos_en)
           VALUES ($1, $2, $3, $4, (SELECT id FROM rol WHERE nombre = 'usuario'), $5)
           RETURNING id`,
          [nombre, datos.username, datos.correo, hash, reloj()],
        );
        const id = rows[0]?.id;
        if (id === undefined) {
          throw new Error("No se devolvió el id del usuario creado");
        }

        await tx.query(
          "INSERT INTO interes_usuario (usuario_id, genero_id) SELECT $1, unnest($2::int[])",
          [id, datos.generoIds],
        );

        return { id, username: datos.username, nombre };
      });
    },
  };
}

export type ServicioRegistro = ReturnType<typeof crearServicioRegistro>;
