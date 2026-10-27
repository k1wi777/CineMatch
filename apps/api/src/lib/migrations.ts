import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

// Ruta absoluta: las migraciones se encuentran igual desde el código fuente, desde tests o desde cualquier cwd.
const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

export type MigrationLogger = { info: (msg: string) => void };

export async function migrateUp(databaseUrl: string, logger: MigrationLogger): Promise<void> {
  await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: "up",
    migrationsTable: "pgmigrations",
    log: (msg) => logger.info(msg),
  });
}
