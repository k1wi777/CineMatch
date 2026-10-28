import { ErrorResponseSchema } from "@cinematch/shared";
import type { ZodType } from "zod";
import { ApiError } from "./errores";
import { notificarSesionPerdida } from "./sesion";

export type OpcionesSubida<T> = {
  // Porcentaje subido (0 a 100). fetch no lo informa, por eso se usa XMLHttpRequest.
  onProgreso?: (porcentaje: number) => void;
  esquema?: ZodType<T>;
};

const MENSAJE_GENERICO = "Algo no salió bien. Inténtalo de nuevo.";

// Subida de archivos con progreso. Mismas reglas que `peticion`: cookies, errores tipados y sesión perdida.
export function subirArchivo<T = unknown>(
  ruta: string,
  datos: FormData,
  opciones: OpcionesSubida<T> = {},
): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ruta);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) {
        opciones.onProgreso?.(Math.round((evento.loaded / evento.total) * 100));
      }
    };
    // Un fallo de red llega como TypeError para que mensajeDeError muestre el aviso de conexión.
    xhr.onerror = () => rechazar(new TypeError("Sin conexión"));
    xhr.onload = () => {
      if (xhr.status === 401) {
        notificarSesionPerdida();
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        rechazar(errorDeRespuesta(xhr));
        return;
      }
      try {
        const json: unknown = xhr.status === 204 ? undefined : JSON.parse(xhr.responseText);
        resolver(opciones.esquema ? (opciones.esquema.parse(json) as T) : (json as T));
      } catch (error) {
        rechazar(error);
      }
    };

    xhr.send(datos);
  });
}

function errorDeRespuesta(xhr: XMLHttpRequest): ApiError {
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(xhr.responseText);
  } catch {
    cuerpo = undefined;
  }
  const parseado = ErrorResponseSchema.safeParse(cuerpo);
  if (!parseado.success) {
    return new ApiError(xhr.status, "ERROR_DESCONOCIDO", MENSAJE_GENERICO);
  }
  const { code, message, fields } = parseado.data.error;
  return new ApiError(xhr.status, code, message, fields ?? {});
}
