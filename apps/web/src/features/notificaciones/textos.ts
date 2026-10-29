import type { Notificacion } from "@cinematch/shared";

// Texto de cada tipo de notificación (los seis tipos de la API). Sin origen de usuario, un texto genérico.
export function textoNotificacion(notificacion: Notificacion): string {
  const quien = notificacion.origen ? `@${notificacion.origen.username}` : null;
  switch (notificacion.tipo) {
    case "recomendacion_recibida":
      return quien ? `${quien} te recomendó un título.` : "Tienes una recomendación nueva.";
    case "recomendacion_aceptada":
      return quien
        ? `${quien} agregó a pendientes tu recomendación.`
        : "Aceptaron tu recomendación.";
    case "recomendacion_completada":
      return quien ? `${quien} completó tu recomendación.` : "Completaron tu recomendación.";
    case "solicitud_amistad":
      return quien
        ? `${quien} te envió una solicitud de amistad.`
        : "Tienes una solicitud de amistad.";
    case "amistad_aceptada":
      return quien
        ? `${quien} aceptó tu solicitud de amistad.`
        : "Aceptaron tu solicitud de amistad.";
    case "resena_oculta":
      return "La moderación ocultó una de tus reseñas.";
  }
}

// Adónde lleva la notificación. Cada tipo de destino tiene su pantalla.
export function hrefNotificacion(notificacion: Notificacion): string {
  switch (notificacion.target.tipo) {
    case "recomendacion":
      return `/recomendaciones/${notificacion.target.id}`;
    case "amistad":
      return notificacion.tipo === "solicitud_amistad" ? "/amigos/solicitudes" : "/amigos";
    case "resena":
      return "/perfil/resenas";
  }
}
