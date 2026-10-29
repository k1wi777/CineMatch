import Image from "next/image";
import Link from "next/link";
import { Cartel } from "./cartel";

// Tarjeta de título: el póster es el protagonista; sin marco ni sombra de tarjeta genérica.
// Sin póster se usa el cartel tipográfico.
export function TarjetaTitulo({
  id,
  titulo,
  anio,
  generos,
  posterUrl,
}: {
  id: number;
  titulo: string;
  anio?: number | null;
  generos?: string[];
  posterUrl?: string | null;
}) {
  return (
    <Link href={`/catalogo/${id}`} className="group block space-y-2">
      {posterUrl ? (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-butaca shadow-foco">
          <Image
            src={posterUrl}
            alt={`Póster de ${titulo}${anio ? `, ${anio}` : ""}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        </div>
      ) : (
        <Cartel titulo={titulo} anio={anio} />
      )}
      <div className="space-y-0.5">
        <p className="font-medium group-hover:text-luz">{titulo}</p>
        {generos && generos.length > 0 ? (
          <p className="text-sm text-niebla">{generos.join(", ")}</p>
        ) : null}
      </div>
    </Link>
  );
}
