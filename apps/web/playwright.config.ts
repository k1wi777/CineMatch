import { defineConfig, devices } from "@playwright/test";

// Pruebas E2E (FE-11.3). Necesitan la API (puerto 4000), la web compilada en producción (puerto 3000) y PostgreSQL.
// Los servidores se arrancan solos si no están ya en marcha. Antes: `pnpm --filter @cinematch/web run build`.
// Chrome y Edge usan los navegadores instalados en el equipo. Firefox y WebKit requieren:
// `pnpm exec playwright install firefox webkit`.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @cinematch/api run start",
      cwd: "../..",
      // Cada ejecución registra y entra con varios usuarios: se sube el límite de autenticación de desarrollo.
      env: { LIMITE_AUTH_DESARROLLO: "1000" },
      url: "http://localhost:4000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @cinematch/web run start",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
