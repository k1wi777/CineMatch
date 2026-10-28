// Avatar con texto alternativo. Sin imagen muestra las iniciales del nombre.
export function Avatar({
  nombre,
  url,
  tamano = 40,
}: {
  nombre: string;
  url?: string | null;
  tamano?: number;
}) {
  const estilo = { width: tamano, height: tamano };
  if (url) {
    return (
      <img
        src={url}
        alt={`Foto de ${nombre}`}
        style={estilo}
        className="rounded-full object-cover"
      />
    );
  }
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      role="img"
      aria-label={`Avatar de ${nombre}`}
      style={estilo}
      className="inline-flex items-center justify-center rounded-full bg-telon text-sm font-semibold text-papel"
    >
      {iniciales}
    </span>
  );
}
