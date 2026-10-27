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
