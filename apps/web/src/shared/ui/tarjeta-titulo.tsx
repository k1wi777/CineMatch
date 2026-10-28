import Link from "next/link";
import { Cartel } from "./cartel";

// Tarjeta de título: el póster es el protagonista; sin marco ni sombra de tarjeta genérica.
export function TarjetaTitulo({
  id,
  titulo,
  anio,
  generos,
}: {
  id: number;
  titulo: string;
  anio?: number | null;
  generos?: string[];
}) {
  return (
    <Link href={`/catalogo/${id}`} className="group block space-y-2">
      <Cartel titulo={titulo} anio={anio} />
      <div className="space-y-0.5">
        <p className="font-medium group-hover:text-luz">{titulo}</p>
        {generos && generos.length > 0 ? (
          <p className="text-sm text-niebla">{generos.join(", ")}</p>
        ) : null}
      </div>
    </Link>
  );
}
