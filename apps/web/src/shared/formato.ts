// Formatos de fecha y número centralizados: todo el texto de la web usa estas funciones.
const LOCALE = "es-ES";

export function formatoFecha(
  fecha: Date | string,
  opciones: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const valor = typeof fecha === "string" ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opciones }).format(valor);
}

export function formatoNumero(numero: number, decimales = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
}

// Calificación de 1 a 5 con medio punto: "4,5".
export function formatoCalificacion(calificacion: number): string {
  return formatoNumero(calificacion, Number.isInteger(calificacion) ? 0 : 1);
}
