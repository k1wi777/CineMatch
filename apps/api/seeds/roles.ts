import type pg from "pg";

export const ROLES = ["usuario", "administrador"] as const;

// Idempotente: los roles que ya existen se dejan como están.
export async function seedRoles(db: pg.PoolClient): Promise<void> {
  await db.query(
    "INSERT INTO rol (nombre) SELECT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING",
    [ROLES],
  );
}
