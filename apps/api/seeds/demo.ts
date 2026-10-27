import type pg from "pg";
import { hashPassword } from "../src/lib/password.js";

// Contraseña común de los usuarios de demostración. Solo para desarrollo local.
export const DEMO_PASSWORD = "Demo1234!";

// Si este usuario existe, los datos de demostración ya están cargados.
const MARCADOR = "demo_ana";

const GENEROS = ["Drama", "Comedia", "Acción", "Ciencia ficción"];

export async function seedDemo(db: pg.PoolClient): Promise<void> {
  const existente = await db.query("SELECT 1 FROM usuario WHERE username = $1", [MARCADOR]);
  if (existente.rowCount) {
    console.log("Los datos de demostración ya existen; se omiten.");
    return;
  }

  await db.query("BEGIN");
  try {
    await cargarDemo(db);
    await db.query("COMMIT");
    console.log("Datos de demostración cargados.");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

async function cargarDemo(db: pg.PoolClient): Promise<void> {
  await db.query(
    "INSERT INTO genero (nombre) SELECT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING",
    [GENEROS],
  );

  const hash = await hashPassword(DEMO_PASSWORD);
  const ana = await crearUsuario(db, "demo_ana", "Ana Demo", hash);
  const luis = await crearUsuario(db, "demo_luis", "Luis Demo", hash);
  const marta = await crearUsuario(db, "demo_marta", "Marta Demo", hash);
  const carlos = await crearUsuario(db, "demo_carlos", "Carlos Demo", hash);

  await asignarIntereses(db, ana, ["Drama", "Comedia", "Ciencia ficción"]);
  await asignarIntereses(db, luis, ["Acción", "Drama", "Comedia"]);
  await asignarIntereses(db, marta, ["Comedia", "Drama", "Ciencia ficción"]);
  await asignarIntereses(db, carlos, ["Acción", "Ciencia ficción", "Drama"]);

  await crearAmistad(db, luis, ana, "aceptada");
  await crearAmistad(db, marta, ana, "aceptada");
  await crearAmistad(db, carlos, ana, "pendiente");

  const viaje = await crearContenido(db, "pelicula", "Demo: Viaje al centro", "demo-1", 42.5, [
    "Drama",
    "Ciencia ficción",
  ]);
  const vecinos = await crearContenido(db, "serie", "Demo: Vecinos", "demo-2", 30.2, ["Comedia"]);
  const persecucion = await crearContenido(db, "pelicula", "Demo: Persecución", "demo-3", 18.7, [
    "Acción",
  ]);

  await crearResena(db, ana, viaje, 5, "Me encantó, imprescindible.", "publica", false, [
    "emotiva",
    "imprescindible",
  ]);
  await crearResena(db, luis, viaje, 3.5, "El final no me convenció.", "amigos", true, ["final"]);
  await crearResena(db, luis, vecinos, 4, "Muy divertida.", "publica", false, ["divertida"]);

  const recomendacion = await crearRecomendacion(
    db,
    luis,
    ana,
    persecucion,
    "Te va a gustar la acción.",
  );
  await crearNotificacionRecomendacion(db, ana, luis, recomendacion);

  await crearSeguimiento(db, ana, viaje, "viendo");
  await crearSeguimiento(db, marta, vecinos, "vista");
  await crearSeguimiento(db, luis, persecucion, "pendiente");
}

async function crearUsuario(
  db: pg.PoolClient,
  username: string,
  nombre: string,
  hash: string,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO usuario (nombre, username, correo, contrasena, rol_id, acepta_datos_en) VALUES ($1, $2, $3, $4, (SELECT id FROM rol WHERE nombre = 'usuario'), now()) RETURNING id",
    [nombre, username, `${username}@demo.cinematch.local`, hash],
  );
  return idDe(rows, username);
}

async function asignarIntereses(
  db: pg.PoolClient,
  usuarioId: number,
  generos: string[],
): Promise<void> {
  await db.query(
    "INSERT INTO interes_usuario (usuario_id, genero_id) SELECT $1, id FROM genero WHERE nombre = ANY($2::text[])",
    [usuarioId, generos],
  );
}

async function crearAmistad(
  db: pg.PoolClient,
  solicitante: number,
  receptor: number,
  estado: "pendiente" | "aceptada",
): Promise<void> {
  await db.query("INSERT INTO amistad (solicitante_id, receptor_id, estado) VALUES ($1, $2, $3)", [
    solicitante,
    receptor,
    estado,
  ]);
}

async function crearContenido(
  db: pg.PoolClient,
  tipo: "pelicula" | "serie",
  titulo: string,
  idExterno: string,
  popularidad: number,
  generos: string[],
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO contenido (tipo, titulo, fuente, id_externo, fecha_actualizacion, popularidad_externa) VALUES ($1, $2, 'demo', $3, now(), $4) RETURNING id",
    [tipo, titulo, idExterno, popularidad],
  );
  const id = idDe(rows, titulo);
  await db.query(
    "INSERT INTO contenido_genero (contenido_id, genero_id) SELECT $1, id FROM genero WHERE nombre = ANY($2::text[])",
    [id, generos],
  );
  return id;
}

async function crearResena(
  db: pg.PoolClient,
  usuarioId: number,
  contenidoId: number,
  calificacion: number,
  comentario: string,
  visibilidad: "publica" | "amigos",
  esSpoiler: boolean,
  etiquetas: string[],
): Promise<void> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO resena (usuario_id, contenido_id, calificacion, comentario, visibilidad, es_spoiler, fecha_creacion) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [usuarioId, contenidoId, calificacion, comentario, visibilidad, esSpoiler],
  );
  const resenaId = idDe(rows, "reseña de demostración");

  for (const texto of etiquetas) {
    await db.query("INSERT INTO etiqueta (texto) VALUES ($1) ON CONFLICT (texto) DO NOTHING", [
      texto,
    ]);
    await db.query(
      "INSERT INTO resena_etiqueta (resena_id, etiqueta_id) SELECT $1, id FROM etiqueta WHERE texto = $2",
      [resenaId, texto],
    );
  }
}

async function crearRecomendacion(
  db: pg.PoolClient,
  emisor: number,
  receptor: number,
  contenido: number,
  motivo: string,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, motivo, fecha_envio) VALUES ($1, $2, $3, $4, now()) RETURNING id",
    [emisor, receptor, contenido, motivo],
  );
  return idDe(rows, "recomendación de demostración");
}

async function crearNotificacionRecomendacion(
  db: pg.PoolClient,
  destinatario: number,
  origen: number,
  recomendacion: number,
): Promise<void> {
  await db.query(
    "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, recomendacion_id) VALUES ($1, $2, 'recomendacion_recibida', $3)",
    [destinatario, origen, recomendacion],
  );
}

async function crearSeguimiento(
  db: pg.PoolClient,
  usuario: number,
  contenido: number,
  estado: "pendiente" | "viendo" | "vista" | "abandonada",
): Promise<void> {
  await db.query("INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, $3)", [
    usuario,
    contenido,
    estado,
  ]);
}

function idDe(rows: { id: number }[], nombre: string): number {
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`No se pudo crear: ${nombre}`);
  }
  return id;
}
