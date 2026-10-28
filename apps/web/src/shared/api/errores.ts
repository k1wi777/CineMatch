import { ErrorResponseSchema } from "@cinematch/shared";

type FieldErrors = Record<string, string>;

// Error de la API tipado: refleja el formato { error: { code, message, fields? } } de BE-2.2.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldErrors = {},
    // Segundos hasta poder reintentar (cabecera Retry-After), por ejemplo con una cuenta bloqueada.
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  // Mensaje de un campo concreto, para mostrarlo junto al input.
  campo(nombre: string): string | undefined {
    return this.fields[nombre];
  }
}

const MENSAJE_RED = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
const MENSAJE_GENERICO = "Algo no salió bien. Inténtalo de nuevo.";

// Convierte cualquier error en un mensaje para el usuario, sin detalles técnicos.
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return MENSAJE_RED;
  return MENSAJE_GENERICO;
}

// Extrae los errores por campo de un error de la API (vacío si no los hay).
export function camposDeError(error: unknown): FieldErrors {
  return error instanceof ApiError ? error.fields : {};
}

// Lee el cuerpo de error de la API. Si el cuerpo no es el formato esperado, usa un código genérico.
export async function leerError(res: Response): Promise<ApiError> {
  const cuerpo = await res.json().catch(() => undefined);
  const parseado = ErrorResponseSchema.safeParse(cuerpo);
  if (!parseado.success) {
    return new ApiError(res.status, "ERROR_DESCONOCIDO", MENSAJE_GENERICO);
  }
  const { code, message, fields } = parseado.data.error;
  const retry = Number(res.headers.get("Retry-After"));
  const retryAfterSeconds = Number.isFinite(retry) && retry > 0 ? retry : undefined;
  return new ApiError(res.status, code, message, fields ?? {}, retryAfterSeconds);
}
