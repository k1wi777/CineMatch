import { ErrorResponseSchema } from "@cinematch/shared";
import { Router, type RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import { registroOpenApi } from "../../lib/openapi.js";

// Swagger UI necesita scripts en línea, así que la documentación relaja la CSP que pone helmet.
const relajarCsp: RequestHandler = (_req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
};

// Documentación de la API. Solo se monta en desarrollo (ver createApp).
export function createDocsRouter(): Router {
  registroOpenApi.registrarEsquema("ErrorResponse", ErrorResponseSchema);

  const router = Router();

  router.get("/docs.json", (_req, res) => {
    res.json(registroOpenApi.generar());
  });

  router.use("/docs", relajarCsp, swaggerUi.serve, swaggerUi.setup(registroOpenApi.generar()));

  return router;
}
