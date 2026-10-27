import "./load-env.js";
import { migrateUp } from "../src/lib/migrations.js";
import { getTestDatabaseUrl } from "./helpers/database.js";

// Antes de cualquier prueba, la base de pruebas queda con todas las migraciones aplicadas.
// Las pruebas de integridad necesitan el esquema real, no una copia.
export default async function setup(): Promise<void> {
  await migrateUp(getTestDatabaseUrl(), { info: () => undefined });
}
