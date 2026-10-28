// Gestión de la sesión desde el cliente: al perderla se limpia la caché y se va al login.
// El provider de consultas registra qué hacer; así el cliente HTTP no depende de React.

type ManejadorSesion = () => void;

let alPerderSesion: ManejadorSesion = () => undefined;

export function registrarManejadorSesion(manejador: ManejadorSesion): void {
  alPerderSesion = manejador;
}

export function notificarSesionPerdida(): void {
  alPerderSesion();
}

// Rutas que pueden responder 401 sin que eso signifique "sesión caducada".
const RUTAS_PUBLICAS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/me",
];

export function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta.startsWith(publica));
}
