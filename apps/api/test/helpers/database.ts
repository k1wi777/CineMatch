import pg from "pg";

// Las pruebas nunca deben tocar la base de desarrollo: solo se acepta una base cuyo nombre termina en _test.
export function assertTestDatabaseUrl(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL debe apuntar a una base *_test; se recibió "${name}".`);
  }
  return url;
}

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Falta TEST_DATABASE_URL. Copia apps/api/.env.example a apps/api/.env.");
  }
  return assertTestDatabaseUrl(url);
}

export function createTestPool(): pg.Pool {
  return new pg.Pool({ connectionString: getTestDatabaseUrl(), connectionTimeoutMillis: 3_000 });
}

// Tabla que registra las migraciones aplicadas: nunca se vacía, o el siguiente `migrate:up` la reintentaría.
const MIGRATIONS_TABLE = "pgmigrations";

// Vacía todas las tablas de public antes de cada prueba. No altera el esquema.
export async function resetDatabase(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> $1",
    [MIGRATIONS_TABLE],
  );
  if (rows.length === 0) return;
  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}
