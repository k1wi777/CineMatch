"use client";

import Image from "next/image";
import Link from "next/link";
import { useCatalogo } from "./catalogo";

// Banda del final de la ficha: más títulos del mismo género que el que se está viendo, con su imagen horizontal.
export function BandaExplora({
  generoId,
  generoNombre,
  excluirId,
}: {
  generoId: number;
  generoNombre: string;
  excluirId: number;
}) {
  const catalogo = useCatalogo({ q: "", generoIds: [generoId], page: 1 });
  const items = (catalogo.data?.items ?? []).filter((item) => item.id !== excluirId).slice(0, 4);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="banda-explora" className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 id="banda-explora" className="font-display text-2xl">
          Más de {generoNombre}
        </h2>
        <Link
          href={`/catalogo?generos=${generoId}`}
          className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          Ver todo
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/catalogo/${item.id}`}
              className="group relative block aspect-video overflow-hidden rounded-md ring-1 ring-papel/10"
            >
              {(item.fondoUrl ?? item.posterUrl) ? (
                <Image
                  src={(item.fondoUrl ?? item.posterUrl) as string}
                  alt={item.titulo}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sala to-transparent p-3 text-sm font-medium text-papel">
                {item.titulo}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
