// Lógica de la cuenta bloqueada y del destino tras entrar, sin React.

// Segundos que faltan hasta `hastaMs`. Nunca es negativo: al llegar a cero el contador se detiene.
export function segundosRestantes(hastaMs: number, ahoraMs: number): number {
  return Math.max(0, Math.ceil((hastaMs - ahoraMs) / 1000));
}

// Formato m:ss para la cuenta atrás (p. ej. 14:59, 0:05).
export function formatoCuentaAtras(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${(segundos % 60).toString().padStart(2, "0")}`;
}

// Tras entrar: vuelve a la ruta pedida si es interna y segura (no //, ni /\, ni /login).
// Si no hay ruta pedida, el administrador va a su panel y el usuario al inicio.
export function destinoTrasLogin(rol: "usuario" | "administrador", siguiente?: string): string {
  const esInterna = siguiente !== undefined && /^\/(?![/\\])/.test(siguiente);
  if (esInterna && !siguiente.startsWith("/login")) return siguiente;
  return rol === "administrador" ? "/admin" : "/";
}
