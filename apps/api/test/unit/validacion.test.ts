import { PaginationQuerySchema } from "@cinematch/shared";
import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { escaparHtml, textoPlano, textoUsuario } from "../../src/lib/text.js";
import { paginar } from "../../src/lib/pagination.js";
import { createErrorHandler } from "../../src/middleware/error-handler.js";
import { validate } from "../../src/middleware/validate.js";
import { z } from "zod";

describe("sanitización de textos (BE-2.3)", () => {
  it("quita las etiquetas HTML y deja texto plano", () => {
    expect(textoPlano("Hola <script>alert('x')</script><b>mundo</b>")).toBe("Hola alert('x')mundo");
  });

  it("normaliza espacios y tabulaciones, pero conserva los saltos de línea", () => {
    expect(textoPlano("  uno   dos\t tres\nlínea  ")).toBe("uno dos tres\nlínea");
  });

  it("escapa los caracteres peligrosos para mostrar en HTML", () => {
    expect(escaparHtml(`<img src=x onerror="alert('1')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;",
    );
  });

  it("el esquema de texto de usuario valida la longitud y guarda texto plano", () => {
    const esquema = textoUsuario(10);

    expect(esquema.parse("<b>hola</b>")).toBe("hola");
    expect(esquema.safeParse("x".repeat(11)).success).toBe(false);
  });
});

describe("paginación estándar", () => {
  it("usa página 1 y 20 elementos por defecto", () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("convierte los valores de la query a números", () => {
    expect(PaginationQuerySchema.parse({ page: "3", pageSize: "10" })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it("rechaza un pageSize por encima del máximo de 50", () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
    expect(PaginationQuerySchema.parse({ pageSize: "50" }).pageSize).toBe(50);
  });

  it("calcula límite y desplazamiento para SQL", () => {
    expect(paginar({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 });
  });
});

describe("middleware validate", () => {
  const silencioso = pino({ level: "silent" });

  function appCon(esquemas: Parameters<typeof validate>[0]) {
    const app = express();
    app.use(express.json());
    app.post("/recurso/:id", validate(esquemas), (_req, res) => {
      res.status(200).json(res.locals.input);
    });
    app.use(createErrorHandler(silencioso));
    return app;
  }

  it("responde 422 con los campos inválidos", async () => {
    const app = appCon({
      body: z.object({ username: z.string().min(3), correo: z.string().email() }),
    });

    const res = await request(app)
      .post("/recurso/1")
      .send({ username: "ab", correo: "no-es-correo" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["correo", "username"]);
  });

  it("deja la entrada parseada en res.locals.input cuando es válida", async () => {
    const app = appCon({
      body: z.object({ comentario: textoUsuario(100) }),
      params: z.object({ id: z.coerce.number().int().positive() }),
    });

    const res = await request(app).post("/recurso/7").send({ comentario: "<i>bien</i>" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { comentario: "bien" }, params: { id: 7 } });
  });

  it("valida los parámetros de la ruta y reporta el campo con prefijo de origen", async () => {
    const app = appCon({ params: z.object({ id: z.coerce.number().int().positive() }) });

    const res = await request(app).post("/recurso/cero").send({});

    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty("id");
  });
});
