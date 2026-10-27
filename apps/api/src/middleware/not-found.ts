import type { ErrorResponse } from "@cinematch/shared";
import type { RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  const body: ErrorResponse = { error: { code: "NOT_FOUND", message: "Ruta no encontrada" } };
  res.status(404).json(body);
};
