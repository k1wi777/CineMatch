// Reglas de la ficha sin React (RN5: el promedio de amigos solo se muestra si hay reseñas de amigos).
export function debeMostrarPromedioAmigos(estadisticas: {
  promedioAmigos: number | null;
  conteoAmigos: number;
}): boolean {
  return estadisticas.conteoAmigos > 0 && estadisticas.promedioAmigos !== null;
}

// Un comentario con spoiler se oculta tras una advertencia hasta que el lector lo pide.
export function comentarioVisible(esSpoiler: boolean, revelado: boolean): boolean {
  return !esSpoiler || revelado;
}
