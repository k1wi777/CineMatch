import type pg from "pg";
import { hashPassword } from "../../src/lib/password.js";

// Datos mínimos para las pruebas de integridad. Cada función devuelve el id creado.

export async function crearUsuario(
  db: pg.Pool,
  username: string,
  correo: string | null = null,
): Promise<number> {
  await db.query("INSERT INTO rol (nombre) VALUES ('usuario') ON CONFLICT (nombre) DO NOTHING");
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO usuario (nombre, username, correo, contrasena, rol_id, acepta_datos_en) VALUES ($1, $2, $3, 'hash', (SELECT id FROM rol WHERE nombre = 'usuario'), now()) RETURNING id",
    [username, username, correo],
  );
  return idDe(rows);
}

// Usuario con contraseña real (argon2id), para probar el inicio de sesión.
export async function crearUsuarioConContrasena(
  db: pg.Pool,
  username: string,
  correo: string,
  contrasena: string,
): Promise<number> {
  const hash = await hashPassword(contrasena);
  await db.query("INSERT INTO rol (nombre) VALUES ('usuario') ON CONFLICT (nombre) DO NOTHING");
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO usuario (nombre, username, correo, contrasena, rol_id, acepta_datos_en) VALUES ($1, $2, $3, $4, (SELECT id FROM rol WHERE nombre = 'usuario'), now()) RETURNING id",
    [username, username, correo, hash],
  );
  return idDe(rows);
}

export async function crearGenero(db: pg.Pool, nombre: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO genero (nombre) VALUES ($1) RETURNING id",
    [nombre],
  );
  return idDe(rows);
}

export async function crearContenido(
  db: pg.Pool,
  tipo: "pelicula" | "serie",
  idExterno: string,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO contenido (tipo, titulo, fuente, id_externo, fecha_actualizacion) VALUES ($1, 'Titulo de prueba', 'tmdb', $2, now()) RETURNING id",
    [tipo, idExterno],
  );
  return idDe(rows);
}

export async function crearResena(
  db: pg.Pool,
  usuarioId: number,
  contenidoId: number,
  calificacion = 4,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO resena (usuario_id, contenido_id, calificacion, fecha_creacion) VALUES ($1, $2, $3, now()) RETURNING id",
    [usuarioId, contenidoId, calificacion],
  );
  return idDe(rows);
}

export async function crearAmistad(
  db: pg.Pool,
  solicitante: number,
  receptor: number,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO amistad (solicitante_id, receptor_id) VALUES ($1, $2) RETURNING id",
    [solicitante, receptor],
  );
  return idDe(rows);
}

export async function crearRecomendacion(
  db: pg.Pool,
  emisor: number,
  receptor: number,
  contenido: number,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, fecha_envio) VALUES ($1, $2, $3, now()) RETURNING id",
    [emisor, receptor, contenido],
  );
  return idDe(rows);
}

function idDe(rows: { id: number }[]): number {
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("La fila de prueba no devolvió id");
  }
  return id;
}
