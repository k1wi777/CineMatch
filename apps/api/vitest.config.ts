import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    // Todas las pruebas comparten la base de pruebas: se ejecutan una a una.
    fileParallelism: false,
  },
});
