import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/lib/db.js";
import { seedAdmin } from "./admin.js";
import { readAdminSeed } from "./config.js";
import { seedDemo } from "./demo.js";
import { seedDemoRico } from "./demo-rico.js";
import { seedRoles } from "./roles.js";

// `pnpm seed` carga roles y el administrador inicial. `pnpm seed:demo` añade los datos de demostración.
const conDemo = process.argv.includes("--demo");
const conDemoRico = process.argv.includes("--demo-rico");

async function main(): Promise<void> {
  const env = loadEnv();
  if ((conDemo || conDemoRico) && env.NODE_ENV === "production") {
    throw new Error("Los datos de demostración no se cargan en producción.");
  }

  const admin = readAdminSeed();
  const pool = createPool(env.DATABASE_URL);
  const client = await pool.connect();

  try {
    await seedRoles(client);
    await seedAdmin(client, admin);
    if (conDemo) {
      await seedDemo(client);
    }
    if (conDemoRico) {
      await seedDemoRico(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
