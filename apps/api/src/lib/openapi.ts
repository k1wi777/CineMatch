import { z } from "zod";

// Registro de la documentación OpenAPI. Cada módulo registra sus endpoints junto a sus rutas,
// y la especificación se genera a partir de este registro y de los esquemas Zod de packages/shared.

export type MetodoHttp = "get" | "post" | "put" | "patch" | "delete";

export type RespuestaDocumentada = {
  descripcion: string;
  // Nombre con el que se registró el esquema con registrarEsquema.
  esquema?: string;
};

export type EndpointDocumentado = {
  metodo: MetodoHttp;
  // Ruta completa, incluido el prefijo /api.
  ruta: string;
  resumen: string;
  respuestas: Record<number, RespuestaDocumentada>;
};

type DocumentoOpenApi = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

export class RegistroOpenApi {
  private readonly endpoints: EndpointDocumentado[] = [];
  private readonly esquemas = new Map<string, z.ZodType>();

  registrarEsquema(nombre: string, esquema: z.ZodType): void {
    this.esquemas.set(nombre, esquema);
  }

  registrar(endpoint: EndpointDocumentado): void {
    this.endpoints.push(endpoint);
  }

  generar(): DocumentoOpenApi {
    const paths: DocumentoOpenApi["paths"] = {};

    for (const endpoint of this.endpoints) {
      const respuestas: Record<string, unknown> = {};
      for (const [codigo, respuesta] of Object.entries(endpoint.respuestas)) {
        respuestas[codigo] = {
          description: respuesta.descripcion,
          ...(respuesta.esquema
            ? {
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${respuesta.esquema}` },
                  },
                },
              }
            : {}),
        };
      }

      paths[endpoint.ruta] = {
        ...paths[endpoint.ruta],
        [endpoint.metodo]: { summary: endpoint.resumen, responses: respuestas },
      };
    }

    const schemas: Record<string, unknown> = {};
    for (const [nombre, esquema] of this.esquemas) {
      schemas[nombre] = this.aJsonSchema(esquema);
    }

    return {
      openapi: "3.1.0",
      info: { title: "CineMatch API", version: "0.0.0" },
      paths,
      components: { schemas },
    };
  }

  private aJsonSchema(esquema: z.ZodType): Record<string, unknown> {
    const schema = z.toJSONSchema(esquema, {
      io: "output",
      unrepresentable: "any",
    }) as Record<string, unknown>;
    // $schema identifica la versión de JSON Schema; dentro de components no hace falta.
    delete schema["$schema"];
    return schema;
  }
}

// Registro compartido por toda la aplicación.
export const registroOpenApi = new RegistroOpenApi();
