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
        <img
          src={posterUrl}
          alt={`Póster de ${titulo}${anio ? `, ${anio}` : ""}`}
          loading="lazy"
          className="aspect-[2/3] w-full rounded-sm bg-butaca object-cover shadow-foco"
        />
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
