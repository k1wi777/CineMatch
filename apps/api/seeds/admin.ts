import type pg from "pg";
import { hashPassword } from "../src/lib/password.js";
import type { AdminSeed } from "./config.js";

// Crea el administrador inicial solo si las variables están definidas y el usuario no existe todavía.
export async function seedAdmin(db: pg.PoolClient, admin: AdminSeed | null): Promise<void> {
  if (!admin) {
    console.log("ADMIN_* no definidas: no se crea administrador.");
    return;
  }

  const existente = await db.query(
    "SELECT 1 FROM usuario WHERE lower(correo) = lower($1) OR lower(username) = lower($2)",
    [admin.correo, admin.username],
  );
  if (existente.rowCount) {
    console.log(`El administrador ${admin.username} ya existe; se omite.`);
    return;
  }

  const hash = await hashPassword(admin.contrasena);
  await db.query(
    // El operador que crea el administrador acepta el tratamiento de datos al hacerlo.
    "INSERT INTO usuario (nombre, username, correo, contrasena, rol_id, acepta_datos_en) VALUES ($1, $2, $3, $4, (SELECT id FROM rol WHERE nombre = 'administrador'), now())",
    [admin.username, admin.username, admin.correo, hash],
  );
  console.log(`Administrador ${admin.username} creado.`);
}
