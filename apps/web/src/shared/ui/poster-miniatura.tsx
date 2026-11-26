import Image from "next/image";
import { Cartel } from "./cartel";

// Póster pequeño de un título para listas de reseñas y recomendaciones. Sin póster muestra el cartel tipográfico.
export function PosterMiniatura({
  titulo,
  posterUrl,
  anio,
}: {
  titulo: string;
  posterUrl: string | null;
  anio?: number | null;
}) {
  return (
    <div className="relative aspect-[2/3] w-16 shrink-0 self-start overflow-hidden rounded-md ring-1 ring-papel/10 sm:w-20">
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={`Póster de ${titulo}`}
          fill
          sizes="80px"
          className="object-cover"
        />
      ) : (
        <Cartel titulo={titulo} anio={anio} />
      )}
    </div>
  );
}
