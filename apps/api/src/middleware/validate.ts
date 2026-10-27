import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { type FieldErrors, ValidationError } from "../lib/errors.js";

type Esquemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

// Valida body, query y params con Zod. Si algo no cumple, responde 422 con los campos afectados.
// Si todo es válido, deja la entrada ya parseada en `res.locals.input` (body, query y params).
export function validate(esquemas: Esquemas): RequestHandler {
  return (req, res, next) => {
    const fields: FieldErrors = {};
    const entrada: Record<string, unknown> = {};

    for (const parte of ["body", "query", "params"] as const) {
      const esquema = esquemas[parte];
      if (!esquema) continue;

      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        entrada[parte] = resultado.data;
        continue;
      }
      for (const issue of resultado.error.issues) {
        const campo = issue.path.join(".") || parte;
        fields[campo] = issue.message;
      }
    }

    if (Object.keys(fields).length > 0) {
      next(new ValidationError(fields));
      return;
    }

    res.locals.input = entrada;
    next();
  };
}
