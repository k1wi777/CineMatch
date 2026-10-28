// Decisión de acceso por ruta, sin dependencias de Next: la usa el proxy y se prueba aparte.
export const NOMBRE_COOKIE_SESION = "cm_session";

const RUTAS_PUBLICAS = ["/login", "/registro", "/recuperar", "/ejemplo-formulario"] as const;

export function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`));
}

export type DecisionAcceso = { accion: "continuar" } | { accion: "login"; siguiente: string };

// Sin cookie de sesión, una ruta protegida va a login recordando a dónde quería ir.
// La presencia de la cookie no basta: la validación real la hace el cliente con GET /api/auth/me.
export function decidirAcceso(ruta: string, tieneCookie: boolean): DecisionAcceso {
  if (esRutaPublica(ruta) || tieneCookie) return { accion: "continuar" };
  return { accion: "login", siguiente: ruta };
}
