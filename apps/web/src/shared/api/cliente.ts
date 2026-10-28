import type { ZodType } from "zod";
import { leerError } from "./errores";
import { esRutaPublica, notificarSesionPerdida } from "./sesion";

export type OpcionesPeticion = {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  signal?: AbortSignal;
  // Si se pasa, la respuesta se valida con el esquema compartido de packages/shared.
  esquema?: ZodType;
};

// Cliente HTTP de la web. Siempre en el mismo origen (/api, proxy de Next), con credenciales.
// Ninguna feature debe usar fetch directamente: todas pasan por aquí.
export async function peticion<T = unknown>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const { metodo = "GET", cuerpo, signal, esquema } = opciones;
  const res = await fetch(ruta, {
    method: metodo,
    credentials: "include",
    signal,
    headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  if (res.status === 401 && !esRutaPublica(ruta)) {
    notificarSesionPerdida();
  }
  if (!res.ok) {
    throw await leerError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const datos: unknown = await res.json();
  return esquema ? (esquema.parse(datos) as T) : (datos as T);
}
