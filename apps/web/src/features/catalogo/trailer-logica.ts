// Reglas del tráiler, sin React. La API guarda solo el enlace de YouTube; aquí se saca la clave del video.

const CLAVE_YOUTUBE = /^[\w-]{6,20}$/;

// Clave del video a partir de un enlace de YouTube (watch?v=, youtu.be/ o youtube.com/embed/). Null si no lo es.
export function claveYoutube(enlace: string): string | null {
  let url: URL;
  try {
    url = new URL(enlace);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  let clave: string | null = null;
  if (host === "youtu.be") {
    clave = url.pathname.slice(1);
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    clave = url.searchParams.get("v") ?? url.pathname.match(/^\/embed\/([^/]+)/)?.[1] ?? null;
  }
  return clave && CLAVE_YOUTUBE.test(clave) ? clave : null;
}

// Versión sin cookies de seguimiento de YouTube, lista para un iframe.
export function urlEmbebida(clave: string): string {
  return `https://www.youtube-nocookie.com/embed/${clave}`;
}
