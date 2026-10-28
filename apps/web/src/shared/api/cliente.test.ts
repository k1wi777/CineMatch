import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, mensajeDeError } from "./errores";
import { peticion } from "./cliente";
import { registrarManejadorSesion } from "./sesion";

function respuesta(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
  });
}

describe("cliente HTTP de la web (FE-0.2)", () => {
  const fetchMock = vi.fn();
  let sesionPerdida: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    sesionPerdida = vi.fn<() => void>();
    registrarManejadorSesion(sesionPerdida);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía credenciales y rutas relativas del mismo origen", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { ok: true }));

    await peticion("/api/genres");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/genres",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("convierte el error de la API en ApiError con sus campos", async () => {
    fetchMock.mockResolvedValue(
      respuesta(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisa los campos.",
          fields: { correo: "Correo no válido." },
        },
      }),
    );

    const error = await peticion("/api/algo", { metodo: "POST", cuerpo: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).campo("correo")).toBe("Correo no válido.");
  });

  it("un cuerpo de error que no sigue el formato da un código genérico", async () => {
    fetchMock.mockResolvedValue(respuesta(500, { algo: "raro" }));

    const error = await peticion("/api/algo").catch((e: unknown) => e);

    expect((error as ApiError).code).toBe("ERROR_DESCONOCIDO");
    expect(mensajeDeError(error)).toBe("Algo no salió bien. Inténtalo de nuevo.");
  });

  it("un 401 en una ruta protegida avisa de sesión perdida", async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, { error: { code: "UNAUTHORIZED", message: "Necesitas iniciar sesión." } }),
    );

    await peticion("/api/users/me").catch(() => undefined);

    expect(sesionPerdida).toHaveBeenCalledTimes(1);
  });

  it("un 401 en login no se trata como sesión perdida", async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, {
        error: { code: "INVALID_CREDENTIALS", message: "Correo o contraseña incorrectos." },
      }),
    );

    await peticion("/api/auth/login", { metodo: "POST", cuerpo: {} }).catch(() => undefined);

    expect(sesionPerdida).not.toHaveBeenCalled();
  });

  it("valida la respuesta con el esquema compartido cuando se pide", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { id: "no-es-numero" }));

    await expect(peticion("/api/x", { esquema: z.object({ id: z.number() }) })).rejects.toThrow();
  });

  it("una respuesta 204 devuelve undefined", async () => {
    fetchMock.mockResolvedValue(respuesta(204));

    await expect(peticion("/api/users/me", { metodo: "DELETE" })).resolves.toBeUndefined();
  });

  it("un fallo de red se traduce a un mensaje de conexión", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await peticion("/api/x").catch((e: unknown) => e);

    expect(mensajeDeError(error)).toContain("No pudimos conectar");
  });
});
