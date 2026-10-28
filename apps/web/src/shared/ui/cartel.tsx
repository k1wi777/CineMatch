// Cartel tipográfico: el título de una película o serie cuando no hay póster.
// El color sale de una paleta fija de cinco tonos, elegido por el título, así cada cartel es estable.
const TONOS = [
  { fondo: "#2b3a4a", texto: "#ebe3d0" },
  { fondo: "#5a2f25", texto: "#ebe3d0" },
  { fondo: "#2f4636", texto: "#ebe3d0" },
  { fondo: "#4a3a1f", texto: "#ebe3d0" },
  { fondo: "#3a2c4a", texto: "#ebe3d0" },
] as const;

function tonoDe(titulo: string) {
  let suma = 0;
  for (const letra of titulo) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return TONOS[suma % TONOS.length] ?? TONOS[0];
}

export function Cartel({ titulo, anio }: { titulo: string; anio?: number | null }) {
  const tono = tonoDe(titulo);
  return (
    <div
      role="img"
      aria-label={`Póster de ${titulo}${anio ? `, ${anio}` : ""}`}
      className="flex aspect-[2/3] flex-col justify-end rounded-sm p-4 shadow-foco"
      style={{ background: tono.fondo, color: tono.texto }}
    >
      <p className="font-display text-xl leading-tight text-balance">{titulo}</p>
      {anio ? <p className="mt-1 text-sm opacity-70">{anio}</p> : null}
    </div>
  );
}
