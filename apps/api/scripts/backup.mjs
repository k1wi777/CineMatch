// Copia de seguridad local de la base de datos (BE-13.5).
// Uso: pnpm backup  (desde apps/api). Requiere el contenedor de PostgreSQL de docker-compose en marcha.
// Crea un volcado en formato custom de pg_dump dentro de ../../backups y borra los de más de 30 días.

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RETENCION_DIAS = 30;
const CONTENEDOR = process.env.BACKUP_CONTAINER ?? "cinematch-postgres";
const BASE_DATOS = process.env.BACKUP_DB ?? "cinematch";
const USUARIO = process.env.BACKUP_USER ?? "cinematch";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const carpeta = join(raiz, "backups");

function marca(fecha) {
  return fecha.toISOString().replace(/[:.]/g, "-");
}

// Vuelca la base con pg_dump dentro del contenedor y guarda la salida en un archivo.
async function volcar(destino) {
  await mkdir(carpeta, { recursive: true });
  await new Promise((resolver, rechazar) => {
    const salida = createWriteStream(destino);
    const proceso = execFile(
      "docker",
      ["exec", CONTENEDOR, "pg_dump", "-U", USUARIO, "-Fc", BASE_DATOS],
      { encoding: "buffer", maxBuffer: 1024 * 1024 * 512 },
    );
    proceso.stdout.pipe(salida);
    proceso.stderr.on("data", () => undefined);
    proceso.on("error", rechazar);
    proceso.on("close", (codigo) => {
      salida.end();
      if (codigo === 0) resolver();
      else rechazar(new Error(`pg_dump terminó con código ${codigo}`));
    });
  });
}

// Borra los respaldos más antiguos que la retención. Devuelve cuántos borró.
async function aplicarRetencion(ahora) {
  const limite = ahora.getTime() - RETENCION_DIAS * 24 * 60 * 60 * 1000;
  let borrados = 0;
  for (const nombre of await readdir(carpeta)) {
    if (!nombre.startsWith("cinematch-") || !nombre.endsWith(".dump")) continue;
    const ruta = join(carpeta, nombre);
    const { mtimeMs } = await stat(ruta);
    if (mtimeMs < limite) {
      await rm(ruta);
      borrados += 1;
    }
  }
  return borrados;
}

async function main() {
  const ahora = new Date();
  const destino = join(carpeta, `cinematch-${marca(ahora)}.dump`);
  try {
    await volcar(destino);
  } catch (err) {
    await rm(destino, { force: true });
    throw err;
  }
  const borrados = await aplicarRetencion(ahora);
  const { size } = await stat(destino);
  console.log(
    `Copia creada: ${destino} (${size} bytes). Respaldos borrados por retención: ${borrados}.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
