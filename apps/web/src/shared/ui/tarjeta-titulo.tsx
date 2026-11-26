import Image from "next/image";
import Link from "next/link";
import { Cartel } from "./cartel";

// Tarjeta de título: póster, nombre y año, lo que pide el ERS para el catálogo.
// Sin géneros ni texto extra: esa información vive en la ficha. Sin póster se usa el cartel tipográfico.
export function TarjetaTitulo({
  id,
  titulo,
  anio,
  posterUrl,
  href,
}: {
  id: number;
  titulo: string;
  anio?: number | null;
  posterUrl?: string | null;
  href?: string;
}) {
  return (
    <Link href={href ?? `/catalogo/${id}`} className="group block space-y-2">
      {posterUrl ? (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md ring-1 ring-papel/10 transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:ring-papel/25">
          <Image
            src={posterUrl}
            alt={`Póster de ${titulo}${anio ? `, ${anio}` : ""}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <Cartel titulo={titulo} anio={anio} />
      )}
      <div className="space-y-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-papel group-hover:text-luz">
          {titulo}
        </p>
        {anio ? <p className="text-xs text-niebla">{anio}</p> : null}
      </div>
    </Link>
  );
}
