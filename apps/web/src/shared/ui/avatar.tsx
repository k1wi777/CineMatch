import Image from "next/image";
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
      <Image
        src={url}
        alt={`Foto de ${nombre}`}
        width={tamano}
        height={tamano}
        sizes={`${tamano}px`}
        // Los avatares locales ya son WebP de 256×256 (los genera la API): no pasan por el optimizador.
        unoptimized={url.startsWith("/")}
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
