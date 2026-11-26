import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { hashPassword } from "../src/lib/password.js";
// Contraseña común de los usuarios de esta semilla. Solo para desarrollo local.
export const PASSWORD_RICO = "Demo12345678!";

// Datos de demostración más completos: usuarios, reseñas, biblioteca, recomendaciones, amistades y notificaciones.
// Los nombres y correos son inventados (dominio @cinematch.test). Todos usan DEMO_PASSWORD. Solo para desarrollo.
type Datos = {
  usuarios: { username: string; nombre: string; bio: string | null; intereses: string[] | null }[];
  titulos: { fuente: string; tipo: "pelicula" | "serie"; titulo: string; id_externo: string }[];
  amistades: { solicitante: string; receptor: string; estado: "pendiente" | "aceptada" | "rechazada" }[];
  resenas: {
    usuario: string;
    titulo: string;
    tipo: "pelicula" | "serie";
    calificacion: number;
    comentario: string | null;
    visibilidad: "publica" | "amigos";
    es_spoiler: boolean;
    visible: boolean;
    etiquetas: string[] | null;
  }[];
  seguimientos: {
    usuario: string;
    titulo: string;
    tipo: "pelicula" | "serie";
    estado: "pendiente" | "viendo" | "vista" | "abandonada";
  }[];
  recomendaciones: {
    emisor: string;
    receptor: string;
    titulo: string;
    tipo: "pelicula" | "serie";
    estado: "enviada" | "abierta" | "aceptada" | "descartada" | "completada";
    motivo: string | null;
    fuera_de_intereses: boolean;
    resena_del_emisor: { calificacion: number; comentario: string | null } | null;
  }[];
  notificaciones: {
    destinatario: string;
    origen: string | null;
    tipo: string;
    leida: boolean;
    recomendacion_de: string | null;
  }[];
};

// Usuario que solo existe en este conjunto de datos: si está, la carga ya se hizo y no se repite.
const MARCADOR = "Camilo_Pacheco";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "datos");

export async function seedDemoRico(db: pg.PoolClient): Promise<void> {
  const existente = await db.query("SELECT 1 FROM usuario WHERE lower(username) = lower($1)", [MARCADOR]);
  if (existente.rowCount) {
    console.log("Los datos de demostración ricos ya existen; se omiten.");
    return;
  }
  const datos = JSON.parse(readFileSync(join(RAIZ, "demo-rico.json"), "utf-8")) as Datos;
  const hash = await hashPassword(PASSWORD_RICO);

  await db.query("BEGIN");
  try {
    const resumen = await cargar(db, datos, hash);
    await db.query("COMMIT");
    console.log(
      `Datos de demostración ricos cargados: ${resumen.usuarios} usuarios, ${resumen.resenas} reseñas, ` +
        `${resumen.recomendaciones} recomendaciones, ${resumen.notificaciones} notificaciones ` +
        `(${resumen.omitidas} notificaciones sin referencia omitidas).`,
    );
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

async function cargar(db: pg.PoolClient, d: Datos, hash: string) {
  const generos = new Set<string>();
  for (const u of d.usuarios) for (const g of u.intereses ?? []) generos.add(g);
  await db.query(
    "INSERT INTO genero (nombre) SELECT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING",
    [[...generos]],
  );

  // Los usuarios que ya existen (por ejemplo, de la semilla de demostración) se reutilizan; no se reemplazan.
  const idUsuario = new Map<string, number>();
  for (const u of d.usuarios) {
    const previo = await db.query<{ id: number }>("SELECT id FROM usuario WHERE lower(username) = lower($1)", [u.username]);
    if (previo.rows[0]) {
      idUsuario.set(u.username, previo.rows[0].id);
      continue;
    }
    const { rows } = await db.query<{ id: number }>(
      "INSERT INTO usuario (nombre, username, correo, contrasena, bio, rol_id, acepta_datos_en) VALUES ($1, $2, $3, $4, $5, (SELECT id FROM rol WHERE nombre = 'usuario'), now()) RETURNING id",
      [u.nombre, u.username, `${u.username.toLowerCase()}@cinematch.test`, hash, u.bio],
    );
    idUsuario.set(u.username, rows[0]!.id);
    if (u.intereses?.length) {
      await db.query(
        "INSERT INTO interes_usuario (usuario_id, genero_id) SELECT $1, id FROM genero WHERE nombre = ANY($2::text[])",
        [rows[0]!.id, u.intereses],
      );
    }
  }

  // Los títulos son del catálogo real (TMDB, con póster). Deben existir: se cargan con `pnpm seed:catalog`.
  const idTitulo = new Map<string, number>();
  for (const t of d.titulos) {
    const { rows } = await db.query<{ id: number }>(
      "SELECT id FROM contenido WHERE fuente = $1 AND tipo = $2 AND id_externo = $3",
      [t.fuente, t.tipo, t.id_externo],
    );
    if (!rows[0]) {
      throw new Error(`Falta en el catálogo: ${t.titulo}. Ejecuta antes \`pnpm seed:catalog\`.`);
    }
    idTitulo.set(`${t.tipo}|${t.titulo}`, rows[0].id);
  }
  const contenido = (tipo: string, titulo: string) => {
    const id = idTitulo.get(`${tipo}|${titulo}`);
    if (id === undefined) throw new Error(`Título no cargado: ${titulo}`);
    return id;
  };
  const usuario = (username: string) => {
    const id = idUsuario.get(username);
    if (id === undefined) throw new Error(`Usuario no cargado: ${username}`);
    return id;
  };

  for (const a of d.amistades) {
    await db.query("INSERT INTO amistad (solicitante_id, receptor_id, estado) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM amistad WHERE (solicitante_id = $1 AND receptor_id = $2) OR (solicitante_id = $2 AND receptor_id = $1))", [
      usuario(a.solicitante),
      usuario(a.receptor),
      a.estado,
    ]);
  }

  for (const r of d.resenas) {
    const { rows } = await db.query<{ id: number }>(
      "INSERT INTO resena (usuario_id, contenido_id, calificacion, comentario, visibilidad, es_spoiler, visible, fecha_creacion) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) ON CONFLICT (usuario_id, contenido_id) DO NOTHING RETURNING id",
      [usuario(r.usuario), contenido(r.tipo, r.titulo), r.calificacion, r.comentario, r.visibilidad, r.es_spoiler, r.visible],
    );
    // Si la reseña ya existía (por ejemplo, de otra semilla), no se duplica.
    if (!rows[0]) continue;
    for (const texto of r.etiquetas ?? []) {
      await db.query("INSERT INTO etiqueta (texto) VALUES ($1) ON CONFLICT (texto) DO NOTHING", [texto]);
      await db.query("INSERT INTO resena_etiqueta (resena_id, etiqueta_id) SELECT $1, id FROM etiqueta WHERE texto = $2", [
        rows[0].id,
        texto,
      ]);
    }
  }

  for (const s of d.seguimientos) {
    await db.query("INSERT INTO seguimiento (usuario_id, contenido_id, estado) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, contenido_id) DO NOTHING", [
      usuario(s.usuario),
      contenido(s.tipo, s.titulo),
      s.estado,
    ]);
  }

  let recomendaciones = 0;
  for (const r of d.recomendaciones) {
    let resenaId: number | null = null;
    if (r.resena_del_emisor) {
      const { rows } = await db.query<{ id: number }>(
        "INSERT INTO resena (usuario_id, contenido_id, calificacion, comentario, visibilidad, fecha_creacion) VALUES ($1, $2, $3, $4, 'publica', now()) ON CONFLICT (usuario_id, contenido_id) DO UPDATE SET usuario_id = resena.usuario_id RETURNING id",
        [usuario(r.emisor), contenido(r.tipo, r.titulo), r.resena_del_emisor.calificacion, r.resena_del_emisor.comentario],
      );
      resenaId = rows[0]!.id;
    }
    const insertada = await db.query(
      "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, resena_id, motivo, fuera_de_intereses, estado, fecha_envio) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) ON CONFLICT (emisor_id, receptor_id, contenido_id) DO NOTHING",
      [usuario(r.emisor), usuario(r.receptor), contenido(r.tipo, r.titulo), resenaId, r.motivo, r.fuera_de_intereses, r.estado],
    );
    recomendaciones += insertada.rowCount ?? 0;
  }

  // Notificaciones: cada una apunta a su recomendación, amistad o reseña (la base lo exige).
  let notificaciones = 0;
  let omitidas = 0;
  for (const n of d.notificaciones) {
    const destinatario = usuario(n.destinatario);
    const origen = n.origen ? usuario(n.origen) : null;
    let recomendacionId: number | null = null;
    let amistadId: number | null = null;
    let resenaId: number | null = null;

    if (n.tipo.startsWith("recomendacion_")) {
      if (!n.recomendacion_de) { omitidas += 1; continue; }
      const [emisor, titulo] = n.recomendacion_de.split("|");
      const { rows } = await db.query<{ id: number }>(
        "SELECT r.id FROM recomendacion r JOIN usuario e ON e.id = r.emisor_id JOIN contenido c ON c.id = r.contenido_id WHERE e.username = $1 AND c.titulo = $2 AND $3 IN (r.emisor_id, r.receptor_id) AND $4 IN (r.emisor_id, r.receptor_id)",
        [emisor, titulo, destinatario, origen],
      );
      recomendacionId = rows[0]?.id ?? null;
    } else if (n.tipo === "solicitud_amistad" || n.tipo === "amistad_aceptada") {
      const { rows } = await db.query<{ id: number }>(
        "SELECT id FROM amistad WHERE (solicitante_id = $1 AND receptor_id = $2) OR (solicitante_id = $2 AND receptor_id = $1) LIMIT 1",
        [destinatario, origen],
      );
      amistadId = rows[0]?.id ?? null;
    } else if (n.tipo === "resena_oculta") {
      const { rows } = await db.query<{ id: number }>(
        "SELECT id FROM resena WHERE usuario_id = $1 AND visible = false LIMIT 1",
        [destinatario],
      );
      resenaId = rows[0]?.id ?? null;
    }

    if (recomendacionId === null && amistadId === null && resenaId === null) {
      omitidas += 1;
      continue;
    }
    // Una notificación igual que ya existe no se duplica.
    const insertada = await db.query(
      "INSERT INTO notificacion (usuario_destinatario_id, usuario_origen_id, tipo, recomendacion_id, amistad_id, resena_id, leida, fecha_creacion) SELECT $1, $2, $3, $4::int, $5::int, $6::int, $7, now() WHERE NOT EXISTS (SELECT 1 FROM notificacion WHERE usuario_destinatario_id = $1 AND tipo = $3 AND recomendacion_id IS NOT DISTINCT FROM $4::int AND amistad_id IS NOT DISTINCT FROM $5::int AND resena_id IS NOT DISTINCT FROM $6::int)",
      [destinatario, origen, n.tipo, recomendacionId, amistadId, resenaId, n.leida],
    );
    notificaciones += insertada.rowCount ?? 0;
  }

  return {
    usuarios: d.usuarios.length,
    resenas: d.resenas.length,
    recomendaciones,
    notificaciones,
    omitidas,
  };
}
