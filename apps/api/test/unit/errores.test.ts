import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
  mapearErrorPostgres,
} from "../../src/lib/errors.js";
import { createErrorHandler } from "../../src/middleware/error-handler.js";

const silencioso = pino({ level: "silent" });

function appQueLanza(error: unknown) {
  const app = express();
  app.get("/fallo", () => {
    throw error;
  });
  app.use(createErrorHandler(silencioso));
  return app;
}

describe("mapeo de errores de PostgreSQL a errores de dominio (BE-2.2)", () => {
  it("traduce un username duplicado (23505) a 409 con el campo username", () => {
    const error = mapearErrorPostgres({ code: "23505", constraint: "usuario_username_lower_key" });

    expect(error).toBeInstanceOf(ConflictError);
    expect(error?.status).toBe(409);
    expect(error?.fields).toEqual({ username: "Ese username ya está en uso." });
  });

  it("traduce una violación de CHECK (23514) a 422 con el campo afectado", () => {
    const error = mapearErrorPostgres({ code: "23514", constraint: "resena_comentario_longitud" });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.status).toBe(422);
    expect(error?.fields).toHaveProperty("comentario");
  });

  it("traduce una violación de clave foránea (23503) a 422 sin campo concreto", () => {
    const error = mapearErrorPostgres({ code: "23503", constraint: "sesion_usuario_id_fkey" });

    expect(error?.status).toBe(422);
    expect(error?.code).toBe("VALIDATION_ERROR");
  });

  it("devuelve undefined para errores que no son de PostgreSQL", () => {
    expect(mapearErrorPostgres(new Error("otra cosa"))).toBeUndefined();
    expect(mapearErrorPostgres({ code: "ECONNREFUSED" })).toBeUndefined();
    expect(mapearErrorPostgres({ code: "99999" })).toBeUndefined();
  });
});

describe("formato de respuesta de errores", () => {
  it("un AppError responde su código, su mensaje y sus campos", async () => {
    const res = await request(
      appQueLanza(new ValidationError({ username: "Demasiado corto." })),
    ).get("/fallo");

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los campos marcados.",
        fields: { username: "Demasiado corto." },
      },
    });
  });

  it("un error sin campos no incluye la propiedad fields", async () => {
    const res = await request(appQueLanza(new NotFoundError("No existe ese título."))).get(
      "/fallo",
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "No existe ese título." } });
  });

  it("un error de PostgreSQL sin traducir responde 500 sin detalles internos", async () => {
    const error = new Error("secreto: cadena de conexión postgres://usuario:clave@host");
    const res = await request(appQueLanza(error)).get("/fallo");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
    });
    expect(JSON.stringify(res.body)).not.toContain("secreto");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  it("todas las subclases de AppError son instancias de AppError", () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ValidationError({})).toBeInstanceOf(AppError);
  });
});
