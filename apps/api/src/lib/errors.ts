// Jerarquía de errores de la API. Cada código es estable: los clientes pueden depender de él.

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "La petición no es válida.") {
    super(400, "BAD_REQUEST", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Necesitas iniciar sesión.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para esta acción.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "El dato ya existe.", fields?: FieldErrors) {
    super(409, "CONFLICT", message, fields);
  }
}

export class ValidationError extends AppError {
  constructor(fields: FieldErrors, message = "Revisa los campos marcados.") {
    super(422, "VALIDATION_ERROR", message, fields);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "La petición supera el tamaño máximo permitido.") {
    super(413, "PAYLOAD_TOO_LARGE", message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "El tipo de archivo no está permitido.") {
    super(415, "UNSUPPORTED_MEDIA_TYPE", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Demasiadas peticiones. Inténtalo más tarde.") {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}

// Restricciones del esquema con su campo afectado y un mensaje que dice qué corregir (BE-1.2 a BE-1.5).
const RESTRICCIONES: Record<string, { campo: string; mensaje: string }> = {
  usuario_username_formato: {
    campo: "username",
    mensaje: "El username debe tener de 3 a 20 caracteres: letras, números o guion bajo.",
  },
  usuario_username_lower_key: { campo: "username", mensaje: "Ese username ya está en uso." },
  usuario_correo_lower_key: { campo: "correo", mensaje: "Ese correo ya está registrado." },
  genero_nombre_key: { campo: "nombre", mensaje: "Ese género ya existe." },
  contenido_fuente_tipo_id_externo_key: {
    campo: "idExterno",
    mensaje: "Ese título ya está registrado.",
  },
  amistad_no_autoamistad: { campo: "receptorId", mensaje: "No puedes agregarte a ti mismo." },
  amistad_par_key: {
    campo: "receptorId",
    mensaje: "Ya existe una solicitud o amistad entre estos usuarios.",
  },
  resena_usuario_contenido_key: {
    campo: "contenidoId",
    mensaje: "Ya tienes una reseña de este título.",
  },
  resena_calificacion_rango_paso: {
    campo: "calificacion",
    mensaje: "La calificación va de 1 a 5, en pasos de 0,5.",
  },
  resena_comentario_longitud: {
    campo: "comentario",
    mensaje: "El comentario no puede superar 2000 caracteres.",
  },
  etiqueta_texto_key: { campo: "etiquetas", mensaje: "Esa etiqueta ya existe." },
  seguimiento_usuario_contenido_key: {
    campo: "contenidoId",
    mensaje: "Este título ya está en tu biblioteca.",
  },
  recomendacion_no_a_uno_mismo: {
    campo: "receptorId",
    mensaje: "No puedes recomendarte un título a ti mismo.",
  },
  recomendacion_emisor_receptor_contenido_key: {
    campo: "contenidoId",
    mensaje: "Ya recomendaste este título a esa persona.",
  },
  notificacion_un_solo_origen: {
    campo: "origen",
    mensaje: "Cada notificación debe tener exactamente un origen.",
  },
};

type ErrorPostgres = { code: string; constraint?: string };

function esErrorPostgres(err: unknown): err is ErrorPostgres {
  // Los códigos de PostgreSQL tienen cinco caracteres; los de Node (ECONNREFUSED, etc.) no.
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof err.code === "string" &&
    err.code.length === 5
  );
}

// Traduce un error de PostgreSQL a un error de dominio con el campo afectado.
// Devuelve undefined si el error no es de PostgreSQL o no tiene traducción.
export function mapearErrorPostgres(err: unknown): AppError | undefined {
  if (!esErrorPostgres(err)) {
    return undefined;
  }

  const restriccion = err.constraint ? RESTRICCIONES[err.constraint] : undefined;

  switch (err.code) {
    case "23505":
      return new ConflictError(
        restriccion?.mensaje ?? "El dato ya existe.",
        restriccion ? { [restriccion.campo]: restriccion.mensaje } : undefined,
      );
    case "23514":
      return new ValidationError(
        restriccion ? { [restriccion.campo]: restriccion.mensaje } : {},
        restriccion?.mensaje ?? "Un dato no cumple las reglas del sistema.",
      );
    case "23503":
      return new ValidationError({}, "Un dato relacionado no existe.");
    case "22P02":
      return new ValidationError({}, "Un valor no es válido.");
    case "22001":
      return new ValidationError({}, "Un texto supera su longitud máxima.");
    default:
      return undefined;
  }
}
