"use client";

import Image from "next/image";
import { useRef } from "react";

// Galería de imágenes del título con flechas para pasar de una a otra. Sin barra de desplazamiento visible.
export function GaleriaTitulo({ imagenes, titulo }: { imagenes: string[]; titulo: string }) {
  const lista = useRef<HTMLUListElement>(null);

  if (imagenes.length === 0) return null;

  function desplazar(sentido: 1 | -1) {
    const elemento = lista.current;
    if (!elemento) return;
    elemento.scrollBy({ left: sentido * elemento.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section aria-labelledby="ficha-galeria" className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 id="ficha-galeria" className="font-display text-2xl">
          Galería
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            aria-label="Imagen anterior"
            className="grid h-10 w-10 place-items-center rounded-full border border-papel/30 hover:border-papel"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            aria-label="Imagen siguiente"
            className="grid h-10 w-10 place-items-center rounded-full border border-papel/30 hover:border-papel"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <ul
        ref={lista}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {imagenes.map((url, indice) => (
          <li
            key={url}
            className="relative aspect-video w-[85%] shrink-0 snap-center overflow-hidden rounded-md ring-1 ring-papel/10 sm:w-[60%] lg:w-[46%]"
          >
            <Image
              src={url}
              alt={`${titulo}, imagen ${indice + 1}`}
              fill
              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 60vw, 46vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
