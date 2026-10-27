import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    // Todas las pruebas comparten la base de pruebas: se ejecutan una a una.
    fileParallelism: false,
    // Con procesos (forks) la suite completa sufría cierres nativos intermitentes del worker (0xC0000409)
    // en Windows: 1 de cada 3 ejecuciones. Con hilos, 3 de 3 ejecuciones completas pasaron.
    pool: "threads",
  },
});
