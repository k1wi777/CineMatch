// Limita cuántas tareas async corren a la vez. Una tarea que termina cede su plaza a la siguiente en cola,
// así el número de tareas activas nunca supera el máximo, ni siquiera con llamadas que llegan justo entonces.
export function crearLimitador(maximo: number) {
  let activas = 0;
  const cola: (() => void)[] = [];

  function liberar() {
    const siguiente = cola.shift();
    if (siguiente) {
      // La plaza pasa directamente a quien esperaba: `activas` no cambia.
      siguiente();
    } else {
      activas -= 1;
    }
  }

  return async function ejecutar<T>(tarea: () => Promise<T>): Promise<T> {
    if (activas >= maximo) {
      await new Promise<void>((resolver) => cola.push(resolver));
    } else {
      activas += 1;
    }
    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
}
