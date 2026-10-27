import { AvatarSchema } from "@cinematch/shared";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { PayloadTooLargeError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioAvatar } from "./avatar.service.js";

// Límite de la subida: 2 MB (decisión cerrada de BE-4.4). Multer lo aplica mientras lee el cuerpo.
export const TAMANO_MAXIMO_AVATAR = 2 * 1024 * 1024;

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_AVATAR, files: 1 },
}).single("avatar");

// Traduce los errores de multer al formato de la API: 413 por tamaño y 422 por campo o número de archivos.
function recibirAvatar(req: Request, res: Response, next: NextFunction): void {
  subida(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(new PayloadTooLargeError("La imagen supera el máximo de 2 MB."));
      return;
    }
    if (err instanceof multer.MulterError) {
      next(new ValidationError({ avatar: "Envía una sola imagen en el campo avatar." }));
      return;
    }
    next(err);
  });
}

registroOpenApi.registrarEsquema("Avatar", AvatarSchema);
registroOpenApi.registrar({
  metodo: "post",
  ruta: "/api/users/me/avatar",
  resumen: "Subir o reemplazar el avatar (JPEG, PNG o WebP; máximo 2 MB)",
  respuestas: {
    200: { descripcion: "Avatar guardado como WebP 256×256 sin metadatos.", esquema: "Avatar" },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    413: { descripcion: "La imagen supera 2 MB.", esquema: "ErrorResponse" },
    415: { descripcion: "El contenido no es JPEG, PNG ni WebP.", esquema: "ErrorResponse" },
    422: { descripcion: "Falta el archivo o no se pudo procesar.", esquema: "ErrorResponse" },
  },
});
registroOpenApi.registrar({
  metodo: "delete",
  ruta: "/api/users/me/avatar",
  resumen: "Quitar el avatar y borrar el archivo",
  respuestas: {
    204: { descripcion: "Avatar eliminado." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
  },
});

export function createAvatarRouter(servicio: ServicioAvatar, servicioAuth: ServicioAuth): Router {
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  // La sesión se valida antes de leer el cuerpo: un anónimo no llega a subir nada.
  router.post("/users/me/avatar", autenticado, recibirAvatar, async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!req.file) {
      throw new ValidationError({ avatar: "Envía una imagen en el campo avatar." });
    }
    const avatarUrl = await servicio.subir(req.user.id, req.file.buffer);
    res.json(AvatarSchema.parse({ avatarUrl }));
  });

  router.delete("/users/me/avatar", autenticado, async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    await servicio.eliminar(req.user.id);
    res.status(204).end();
  });

  return router;
}
