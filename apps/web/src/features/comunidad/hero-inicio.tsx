"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDestacados } from "@/features/catalogo/catalogo";
import { mensajeDeError } from "@/shared/api";
import { Chip } from "@/shared/ui/chip";
import { EstadoError } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";

const INTERVALO_MS = 8000;
const MAX_GENEROS = 3;

// Carrusel de destacados del inicio, a ancho completo: imagen horizontal de fondo, póster como arte del título,
// texto, flechas y puntos. Avanza solo cada pocos segundos, salvo que el usuario pida reducir el movimiento
// o pase el foco por encima.
export function HeroInicio() {
  const t = useTranslations("inicio.hero");
  const destacados = useDestacados();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = destacados.data?.length ?? 0;

  useEffect(() => {
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (total < 2 || pausado || reducirMovimiento) return;
    const reloj = window.setInterval(
      () => setIndice((actual) => (actual + 1) % total),
      INTERVALO_MS,
    );
    return () => window.clearInterval(reloj);
  }, [total, pausado]);

  if (destacados.isPending) {
    return <Skeleton className="h-[28rem] w-full md:h-[32rem]" />;
  }
  if (destacados.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(destacados.error)}
        onReintentar={() => void destacados.refetch()}
      />
    );
  }
  if (total === 0) return null;

  const actual = indice % total;
  const lista = destacados.data;

  function anterior() {
    setIndice((i) => (i - 1 + total) % total);
  }
  function siguiente() {
    setIndice((i) => (i + 1) % total);
  }

  return (
    <section
      aria-label={t("titulo")}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-sala"
    >
      <div className="relative h-[28rem] md:h-[32rem]">
        {lista.map((item, posicion) => {
          const visible = posicion === actual;
          return (
            <div
              key={item.id}
              inert={!visible}
              aria-hidden={!visible}
              className={`absolute inset-0 transition-opacity duration-700 ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <Image
                src={item.fondoUrl}
                alt=""
                fill
                priority={posicion === 0}
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-sala via-sala/75 to-sala/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-sala via-transparent to-transparent" />

              <div className="relative mx-auto flex h-full max-w-6xl items-end px-6 pb-16 md:items-center md:px-16 md:pb-0">
                <div className="min-w-0 max-w-xl space-y-4">
                  <p className="text-sm text-papel/70">
                    {t(`tipo.${item.tipo}`)}
                    {item.anio ? ` · ${item.anio}` : ""}
                  </p>
                  {item.logoUrl ? (
                    <h2 className="relative h-20 w-full max-w-md md:h-28">
                      <Image
                        src={item.logoUrl}
                        alt={item.titulo}
                        fill
                        sizes="(max-width: 768px) 320px, 448px"
                        className="object-contain object-left"
                      />
                    </h2>
                  ) : (
                    <h2 className="font-display text-3xl md:text-5xl">{item.titulo}</h2>
                  )}
                  {item.generos.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {item.generos.slice(0, MAX_GENEROS).map((genero) => (
                        <li key={genero.id}>
                          <Chip texto={genero.nombre} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.sinopsis ? (
                    <p className="line-clamp-3 text-papel/85">{item.sinopsis}</p>
                  ) : null}
                </div>
              </div>

              <Link
                href={`/catalogo/${item.id}`}
                className="absolute bottom-4 right-6 z-10 inline-flex items-center gap-2 rounded-sm border border-papel/40 bg-sala/60 px-3 py-1.5 text-sm backdrop-blur hover:border-papel md:bottom-6 md:right-16"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
                {t("masInfo")}
              </Link>
            </div>
          );
        })}

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={anterior}
              aria-label={t("anterior")}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-sala/70 px-3 py-2 text-xl text-papel hover:bg-sala"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label={t("siguiente")}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-sala/70 px-3 py-2 text-xl text-papel hover:bg-sala"
            >
              <span aria-hidden="true">›</span>
            </button>

            <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center">
              {lista.map((item, posicion) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndice(posicion)}
                  aria-label={t("irA", { n: posicion + 1 })}
                  aria-current={posicion === actual ? "true" : undefined}
                  className="-mx-1 flex h-6 w-6 items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      posicion === actual ? "bg-papel" : "bg-papel/35"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
