import { existsSync } from "node:fs";

// Carga apps/api/.env si existe. En CI, las variables llegan del entorno y no hace falta el archivo.
// Node no sobrescribe variables que ya están definidas, así que TEST_DATABASE_URL del entorno gana.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
