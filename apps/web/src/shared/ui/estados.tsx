import type { ReactNode } from "react";

// Estado vacío: explica qué falta y, si hay, ofrece el paso siguiente.
export function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-prose space-y-3 py-16 text-center">
      <h2 className="font-display text-2xl">{titulo}</h2>
      <p className="text-niebla">{texto}</p>
      {accion ? <div className="pt-2">{accion}</div> : null}
    </section>
  );
}

// Estado de error: dice qué pasó y cómo seguir. Nunca muestra detalles técnicos.
export function EstadoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-prose space-y-3 border-l-2 border-brasa py-6 pl-5"
    >
      <h2 className="font-display text-xl">No pudimos cargar esto</h2>
      <p className="text-papel/85">{mensaje}</p>
      {onReintentar ? (
        <button
          type="button"
          onClick={onReintentar}
          className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz hover:text-luz"
        >
          Intentar de nuevo
        </button>
      ) : null}
    </section>
  );
}
