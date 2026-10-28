// Lógica de las estrellas de calificación, sin React. Valores de 1 a 5 en pasos de 0,5 (RN1).
export const MIN_CALIFICACION = 1;
export const MAX_CALIFICACION = 5;
export const PASO_CALIFICACION = 0.5;

function acotar(valor: number): number {
  return Math.min(MAX_CALIFICACION, Math.max(MIN_CALIFICACION, valor));
}

// Teclado: flechas mueven medio punto, Inicio y Fin van a los extremos. Otras teclas no cambian el valor.
export function ajustarCalificacion(valor: number, tecla: string): number {
  switch (tecla) {
    case "ArrowRight":
    case "ArrowUp":
      return acotar(valor + PASO_CALIFICACION);
    case "ArrowLeft":
    case "ArrowDown":
      return acotar(valor - PASO_CALIFICACION);
    case "Home":
      return MIN_CALIFICACION;
    case "End":
      return MAX_CALIFICACION;
    default:
      return valor;
  }
}

// Ratón: la mitad izquierda de una estrella vale medio punto menos que la estrella completa.
export function calificacionDesdeClic(
  estrella: number,
  posicionEnEstrella: number,
  ancho: number,
): number {
  const mitadIzquierda = posicionEnEstrella < ancho / 2;
  return acotar(mitadIzquierda ? estrella - PASO_CALIFICACION : estrella);
}

// Fracción rellena de una estrella (0, 0,5 o 1) para dibujar la calificación.
export function rellenoEstrella(valor: number, indice: number): number {
  const restante = valor - indice;
  if (restante >= 1) return 1;
  if (restante <= 0) return 0;
  return restante >= PASO_CALIFICACION ? PASO_CALIFICACION : 0;
}
