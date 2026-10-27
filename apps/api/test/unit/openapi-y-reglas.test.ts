import { z } from "zod";
import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import { reglasDeNegocio } from "../../src/config/business-rules.js";
import { RegistroOpenApi } from "../../src/lib/openapi.js";

const BASE = { DATABASE_URL: "postgres://usuario:clave@localhost:5432/cinematch" };

describe("generación de OpenAPI (BE-2.6)", () => {
  it("genera un documento 3.1 con las rutas registradas y sus respuestas", () => {
    const registro = new RegistroOpenApi();
    registro.registrarEsquema("Estado", z.object({ status: z.enum(["ok", "degraded"]) }));
    registro.registrar({
      metodo: "get",
      ruta: "/api/estado",
      resumen: "Estado",
      respuestas: { 200: { descripcion: "Correcto", esquema: "Estado" } },
    });

    const documento = registro.generar();

    expect(documento.openapi).toBe("3.1.0");
    expect(documento.paths["/api/estado"]).toEqual({
      get: {
        summary: "Estado",
        responses: {
          200: {
            description: "Correcto",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Estado" } },
            },
          },
        },
      },
    });
  });

  it("convierte los esquemas Zod a JSON Schema en components", () => {
    const registro = new RegistroOpenApi();
    registro.registrarEsquema(
      "Error",
      z.object({
        error: z.object({ code: z.string(), fields: z.record(z.string(), z.string()).optional() }),
      }),
    );

    const esquema = registro.generar().components.schemas["Error"] as {
      type: string;
      required: string[];
      $schema?: string;
    };

    expect(esquema.type).toBe("object");
    expect(esquema.required).toEqual(["error"]);
    expect(esquema.$schema).toBeUndefined();
  });

  it("documenta los endpoints de BE-0 en el registro compartido", async () => {
    const { registroOpenApi } = await import("../../src/lib/openapi.js");
    const { createHealthRouter } = await import("../../src/modules/health/health.routes.js");
    const pool = { query: async () => ({ rows: [] }) } as unknown as Parameters<
      typeof createHealthRouter
    >[0];
    createHealthRouter(pool);

    expect(registroOpenApi.generar().paths["/api/health"]).toHaveProperty("get");
  });
});

describe("reglas de negocio (BE-2.7)", () => {
  it("los valores por defecto coinciden con el ERS", () => {
    expect(reglasDeNegocio(loadEnv(BASE))).toEqual({
      TAG_MIN_REVIEWS: 3,
      COMMUNITY_MIN_RATINGS: 5,
      COMMUNITY_CACHE_TTL_MINUTES: 60,
      SESSION_IDLE_MINUTES: 30,
      LOGIN_MAX_ATTEMPTS: 5,
      LOGIN_LOCK_MINUTES: 15,
      RESET_TOKEN_TTL_MINUTES: 60,
    });
  });

  it("acepta valores configurados desde el entorno como texto", () => {
    const reglas = reglasDeNegocio(
      loadEnv({ ...BASE, LOGIN_MAX_ATTEMPTS: "3", TAG_MIN_REVIEWS: "4" }),
    );

    expect(reglas.LOGIN_MAX_ATTEMPTS).toBe(3);
    expect(reglas.TAG_MIN_REVIEWS).toBe(4);
  });

  it("una regla inválida impide arrancar y el error nombra la variable", () => {
    expect(() => loadEnv({ ...BASE, LOGIN_MAX_ATTEMPTS: "0" })).toThrow("LOGIN_MAX_ATTEMPTS");
    expect(() => loadEnv({ ...BASE, SESSION_IDLE_MINUTES: "no-es-numero" })).toThrow(
      "SESSION_IDLE_MINUTES",
    );
  });
});
