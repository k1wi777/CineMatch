import nodemailer from "nodemailer";
import { escaparHtml } from "./text.js";

// Canal de correo usado por la recuperación de contraseña. Las pruebas lo sustituyen por uno falso.
export type ServicioCorreo = {
  enviarRecuperacion(destino: string, enlace: string): Promise<void>;
};

export type ConfigSmtp = {
  host: string;
  port: number;
  from: string;
};

// Correo en español con el enlace de recuperación. Mailpit lo muestra en http://localhost:8025 en desarrollo.
export function crearCorreoSmtp(config: ConfigSmtp): ServicioCorreo {
  const transporte = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async enviarRecuperacion(destino, enlace) {
      const enlaceSeguro = escaparHtml(enlace);
      await transporte.sendMail({
        from: config.from,
        to: destino,
        subject: "Restablece tu contraseña de CineMatch",
        text: `Pediste restablecer tu contraseña. Usa este enlace, que vence en 1 hora y solo sirve una vez:\n\n${enlace}\n\nSi no fuiste tú, ignora este correo.`,
        html: `<p>Pediste restablecer tu contraseña. Usa este enlace, que vence en 1 hora y solo sirve una vez:</p><p><a href="${enlaceSeguro}">Restablecer contraseña</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
      });
    },
  };
}
