import { z } from "zod";

// Enviar una solicitud de amistad (BE-7.1). El id del usuario destinatario viene en el cuerpo; el remitente, de la sesión.
export const EnviarSolicitudAmistadSchema = z.object({
  usuarioId: z.number().int().positive(),
});

export type EnviarSolicitudAmistad = z.infer<typeof EnviarSolicitudAmistadSchema>;

export const EstadoAmistadSchema = z.enum(["pendiente", "aceptada", "rechazada"]);

export const AmistadSchema = z.object({
  id: z.number().int(),
  estado: EstadoAmistadSchema,
  solicitanteId: z.number().int(),
  receptorId: z.number().int(),
  fechaSolicitud: z.string(),
  fechaRespuesta: z.string().nullable(),
});

export type AmistadRespuesta = z.infer<typeof AmistadSchema>;

// Datos mínimos de otra persona en las listas y la búsqueda (BE-7.3 y BE-7.5).
export const UsuarioResumenSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  nombre: z.string(),
  avatarUrl: z.string().nullable(),
});

export type UsuarioResumen = z.infer<typeof UsuarioResumenSchema>;

export const AmistadListaItemSchema = z.object({
  amistadId: z.number().int(),
  usuario: UsuarioResumenSchema,
});

export const SolicitudListaItemSchema = z.object({
  id: z.number().int(),
  usuario: UsuarioResumenSchema,
  fechaSolicitud: z.string(),
});

export const RelacionUsuarioSchema = z.enum([
  "ninguna",
  "pendienteEnviada",
  "pendienteRecibida",
  "amigos",
]);

export type RelacionUsuario = z.infer<typeof RelacionUsuarioSchema>;

export const BusquedaUsuarioItemSchema = UsuarioResumenSchema.extend({
  relacion: RelacionUsuarioSchema,
});

export const BusquedaUsuariosQuerySchema = z.object({
  q: z.string().trim().min(1, "Escribe al menos una letra.").max(50),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type BusquedaUsuariosQuery = z.infer<typeof BusquedaUsuariosQuerySchema>;

export const ContadorSolicitudesSchema = z.object({
  pendientes: z.number().int(),
});
