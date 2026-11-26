"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDestacados } from "@/features/catalogo/catalogo";
import { useRegion } from "@/features/catalogo/region";
import { reportarTrailerNoDisponible } from "@/features/catalogo/ficha";
import { mensajeDeError } from "@/shared/api";
import { Chip } from "@/shared/ui/chip";
import { EstadoError } from "@/shared/ui/estados";
import { Estrellas } from "@/shared/ui/estrellas";
import { Skeleton } from "@/shared/ui/skeleton";
import { VideoFondo } from "@/shared/ui/video-fondo";

const MAX_GENEROS = 3;
// Secuencia por título: póster, tráiler de fondo (hasta que termina), póster y siguiente título.
const ESPERA_POSTER_MS = 3000;
const ESPERA_SIN_MOVIMIENTO_MS = 8000;
const LIMITE_TRAILER_MS = 180_000;

type Fase = "inicial" | "trailer" | "final";

// Carrusel de destacados a ancho completo: imagen horizontal, logotipo, texto y tráiler de fondo.
// Avanza solo. Se pausa al pasar el ratón o el foco por encima, salvo mientras suena el tráiler.
export function HeroInicio() {
  const t = useTranslations("inicio.hero");
  const { region } = useRegion();
  const destacados = useDestacados(region);
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>("inicial");
  const [pausado, setPausado] = useState(false);
  // Vista del carrusel: las sugerencias de CineMatch o los destacados del país.
  const [vista, setVista] = useState<"sugerencias" | "pais">("sugerencias");
  const lista = (destacados.data ?? []).filter((item) =>
    vista === "sugerencias" ? item.sugerencia : !item.sugerencia,
  );
  const total = lista.length;
  const actual = total > 0 ? indice % total : 0;

  useEffect(() => {
    if (total === 0) return;
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (fase === "trailer") {
      // Mientras el tráiler suena, el hero no avanza solo; este límite evita quedarse atascado.
      const limite = window.setTimeout(() => setFase("final"), LIMITE_TRAILER_MS);
      return () => window.clearTimeout(limite);
    }
    // Como en la ficha, el tráiler empieza en cuanto aparece el título (si hay movimiento permitido).
    if (fase === "inicial") {
      if (!reducirMovimiento) {
        setFase("trailer");
        return;
      }
      // Con movimiento reducido no hay tráiler: el póster se queda un rato y pasa al siguiente.
      if (total < 2 || pausado) return;
      const espera = window.setTimeout(() => {
        setIndice((i) => (i + 1) % total);
        setFase("inicial");
      }, ESPERA_SIN_MOVIMIENTO_MS);
      return () => window.clearTimeout(espera);
    }

    // Tras el tráiler, el póster se queda un momento y pasa al siguiente título.
    // La pausa (cursor o foco) solo frena este paso.
    if (total < 2 || pausado) return;
    const espera = window.setTimeout(() => {
      setIndice((i) => (i + 1) % total);
      setFase("inicial");
    }, ESPERA_POSTER_MS);
    return () => window.clearTimeout(espera);
  }, [total, fase, actual, pausado]);

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

  function irA(posicion: number) {
    setIndice(posicion);
    setFase("inicial");
  }
  function anterior() {
    setIndice((i) => (i - 1 + total) % total);
    setFase("inicial");
  }
  function siguiente() {
    setIndice((i) => (i + 1) % total);
    setFase("inicial");
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
        <button
          type="button"
          onClick={() => {
            setVista(vista === "sugerencias" ? "pais" : "sugerencias");
            setIndice(0);
            setFase("inicial");
          }}
          className="absolute right-6 top-4 z-20 rounded-sm border border-papel/40 bg-sala/60 px-2.5 py-1 text-xs backdrop-blur hover:border-papel md:right-6 md:top-6"
        >
          {vista === "sugerencias" ? t("verPais") : t("verSugerencias")}
        </button>
        {lista.map((item, posicion) => {
          const visible = posicion === actual;
          const enTrailer = visible && fase === "trailer";
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

              {enTrailer ? (
                <VideoFondo
                  url={item.trailerUrl}
                  alTerminar={() => setFase("final")}
                  alNoHayTrailer={() => {
                    reportarTrailerNoDisponible(item.id);
                    setFase("final");
                  }}
                />
              ) : null}

              <div className="absolute inset-0 bg-gradient-to-r from-sala/80 via-sala/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sala/70 to-transparent" />

              <div className="relative mx-auto flex h-full max-w-6xl items-end px-6 pb-16 md:items-center md:px-16 md:pb-0">
                <div className="min-w-0 max-w-xl space-y-4">
                  <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-8">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-papel/90">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-luz" />
                      {item.sugerencia ? t("sugerencia") : t("puesto", { n: posicion + 1 })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
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
                  </div>
                  <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3">
                    <ul className="flex flex-wrap gap-2">
                      {item.generos.slice(0, MAX_GENEROS).map((genero) => (
                        <li key={genero.id}>
                          <Chip texto={genero.nombre} />
                        </li>
                      ))}
                      <li>
                        <Chip
                          texto={`${t(`tipo.${item.tipo}`)}${item.anio ? ` · ${item.anio}` : ""}`}
                        />
                      </li>
                    </ul>
                    <div className="flex items-center gap-2">
                      <Estrellas valor={item.promedio ?? 0} etiqueta={t("calificacionMedia")} />
                      <span className="text-xs text-niebla">TMDB</span>
                    </div>
                  </div>
                  {item.sinopsis ? (
                    <p className="line-clamp-5 max-w-xl text-base text-papel/90 md:text-lg">
                      {item.sinopsis}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="absolute bottom-16 right-6 z-10 flex items-center gap-3 md:bottom-24 md:right-6">
                <Link
                  href={`/catalogo/${item.id}`}
                  className="rounded-sm border border-papel/40 px-5 py-2.5 text-sm font-semibold text-papel hover:border-papel"
                >
                  {t("verFicha")}
                </Link>
                <Link
                  href={`/catalogo/${item.id}`}
                  aria-label={t("verFicha")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-papel/40 text-lg hover:border-papel"
                >
                  +
                </Link>
              </div>
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
                  onClick={() => irA(posicion)}
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
