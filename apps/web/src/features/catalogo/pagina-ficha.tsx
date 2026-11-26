"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ApiError, mensajeDeError } from "@/shared/api";
import { formatoCalificacion, formatoNumero } from "@/shared/formato";
import { Cartel } from "@/shared/ui/cartel";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { VideoFondo } from "@/shared/ui/video-fondo";
import { BarraAcciones } from "./barra-acciones";
import { BandaExplora } from "./banda-explora";
import { GaleriaTitulo } from "./galeria-titulo";
import { BotonTrailer } from "./boton-trailer";
import { debeMostrarPromedioAmigos } from "./ficha-logica";
import {
  reportarTrailerNoDisponible,
  useEstadisticas,
  useFicha,
  useResenasTitulo,
  useTrailer,
} from "./ficha";
import { ResenaItem } from "@/features/resenas/resena-item";
import { MiResena } from "./mi-resena";

const TAMANO_RESENAS = 20;

// Ficha de un título (FE-4.2). La barra de acciones (FE-4.3) va al final, fija en móvil.
export function PaginaFicha({ id }: { id: number }) {
  const t = useTranslations("ficha");
  const ficha = useFicha(id);
  const estadisticas = useEstadisticas(id);
  const trailer = useTrailer(id, true);
  // Si el tráiler termina o no se puede reproducir, la cabecera vuelve al póster.
  const [sinVideo, setSinVideo] = useState(false);
  const videoUrl = !sinVideo && trailer.data?.url ? trailer.data.url : null;
  const [paginaResenas, setPaginaResenas] = useState(1);
  const resenas = useResenasTitulo(id, paginaResenas);

  if (ficha.isPending) {
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (ficha.isError) {
    if (ficha.error instanceof ApiError && ficha.error.status === 404) {
      return (
        <section className="space-y-4">
          <EstadoVacio titulo={t("noEncontrado")} texto={t("noEncontradoTexto")} />
          <Link href="/catalogo" className="block text-center text-sm text-niebla hover:text-papel">
            {t("volver")}
          </Link>
        </section>
      );
    }
    return (
      <EstadoError
        mensaje={mensajeDeError(ficha.error)}
        onReintentar={() => void ficha.refetch()}
      />
    );
  }

  const titulo = ficha.data;
  const stats = estadisticas.data;

  return (
    <article className="space-y-12 pb-24 md:pb-0">
      {/* El fondo se extiende hacia fuera (margen negativo igual al padding) para que el contenido quede alineado con el resto de la página. */}
      <header className="relative -mt-8 left-1/2 flex min-h-[80vh] w-screen -translate-x-1/2 items-center overflow-hidden bg-sala pb-24 pt-24 md:pb-32">
        {videoUrl ? (
          <VideoFondo
            url={videoUrl}
            alTerminar={() => setSinVideo(true)}
            alNoHayTrailer={() => {
              reportarTrailerNoDisponible(id);
              setSinVideo(true);
            }}
          />
        ) : titulo.posterUrl ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <Image
              src={titulo.posterUrl}
              alt=""
              fill
              sizes="100vw"
              className="scale-110 object-cover opacity-60 blur-xl"
            />
          </div>
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sala/60 via-sala/20 to-transparent"
        />
        {/* Desvanecimiento hacia la página: la parte de abajo se funde con el fondo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-sala via-sala/70 to-transparent"
        />

        <div className="relative flex w-full flex-col gap-6 rounded-md bg-sala/35 p-4 ring-1 ring-papel/10 backdrop-blur-md sm:flex-row md:w-[72%] md:p-6 ml-4 md:ml-10 xl:ml-[max(2.5rem,calc((100vw-72rem)/2))]">
          <div className="w-40 shrink-0 self-start sm:w-64 lg:w-80">
            {titulo.posterUrl ? (
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-foco">
                <Image
                  src={titulo.posterUrl}
                  alt={t("poster", { titulo: titulo.titulo })}
                  fill
                  priority
                  sizes="(max-width: 640px) 160px, 224px"
                  className="object-cover"
                />
              </div>
            ) : (
              <Cartel titulo={titulo.titulo} anio={titulo.anio} />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="font-display text-3xl sm:text-4xl">{titulo.titulo}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-sm border border-papel/15 bg-sala/40 px-3 py-2 text-sm text-papel/85 backdrop-blur-md">
                  {t(`tipo.${titulo.tipo}`)}
                  {titulo.anio ? ` · ${titulo.anio}` : ""}
                </span>
                <BotonTrailer id={id} titulo={titulo.titulo} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              {titulo.director ? (
                <p className="text-papel/85">
                  <span className="text-niebla">{t("director")}: </span>
                  {titulo.director}
                </p>
              ) : (
                <span />
              )}
            </div>
            {titulo.generos.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("generos")}>
                {titulo.generos.map((genero) => (
                  <li key={genero.id}>
                    <Chip texto={genero.nombre} />
                  </li>
                ))}
                {titulo.duracion ? (
                  <li>
                    <Chip texto={t("duracion", { minutos: titulo.duracion })} />
                  </li>
                ) : null}
                <li className="ml-auto">
                  <Estrellas
                    valor={stats?.promedioPublico ?? 0}
                    etiqueta={t("comunidad.promedio")}
                  />
                </li>
              </ul>
            ) : null}
            {stats && stats.etiquetasComunidad.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("comunidad.etiquetas")}>
                {stats.etiquetasComunidad.slice(0, 5).map((etiqueta) => (
                  <li key={etiqueta.texto}>
                    <Chip texto={etiqueta.texto} />
                  </li>
                ))}
              </ul>
            ) : null}
            <section aria-labelledby="ficha-sinopsis" className="space-y-2">
              <h2 id="ficha-sinopsis" className="text-sm text-niebla">
                {t("sinopsis")}
              </h2>
              <p className="text-papel/85">{titulo.sinopsis ?? t("sinSinopsis")}</p>
            </section>
            {titulo.reparto.length > 0 ? (
              <section aria-labelledby="ficha-reparto" className="mt-6 space-y-3">
                <h2 id="ficha-reparto" className="text-sm text-niebla">
                  Reparto
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {titulo.reparto.map((nombre) => (
                    <li key={nombre}>
                      <Chip texto={nombre} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </header>

      <GaleriaTitulo imagenes={titulo.galeria} titulo={titulo.titulo} />

      <section aria-labelledby="ficha-comunidad" className="space-y-5">
        <h2 id="ficha-comunidad" className="font-display text-2xl">
          {t("comunidad.titulo")}
        </h2>
        {stats ? (
          <div className="space-y-4">
            {stats.promedioPublico !== null ? (
              <div className="flex flex-wrap items-center gap-3">
                <Estrellas valor={stats.promedioPublico} etiqueta={t("comunidad.promedio")} />
                <p className="text-papel/85">
                  {formatoCalificacion(stats.promedioPublico)}
                  <span className="ml-2 text-sm text-niebla">
                    {t("comunidad.calificaciones", { total: formatoNumero(stats.conteoPublico) })}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-niebla">{t("comunidad.sinCalificaciones")}</p>
            )}

            {debeMostrarPromedioAmigos(stats) ? (
              <p className="text-sm text-papel/85">
                <span className="text-niebla">{t("comunidad.amigos")}: </span>
                {formatoCalificacion(stats.promedioAmigos ?? 0)}
                <span className="ml-2 text-niebla">
                  {t("comunidad.amigosTotal", { total: stats.conteoAmigos })}
                </span>
              </p>
            ) : null}

            {stats.etiquetasComunidad.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-niebla">{t("comunidad.etiquetas")}</p>
                <ul className="flex flex-wrap gap-2">
                  {stats.etiquetasComunidad.map((etiqueta) => (
                    <li key={etiqueta.texto}>
                      <Chip texto={`${etiqueta.texto} · ${etiqueta.veces}`} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : estadisticas.isError ? (
          <EstadoError
            mensaje={mensajeDeError(estadisticas.error)}
            onReintentar={() => void estadisticas.refetch()}
          />
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </section>

      <section aria-labelledby="ficha-mi-resena" className="space-y-5">
        <h2 id="ficha-mi-resena" className="font-display text-2xl">
          {t("miResena.titulo")}
        </h2>
        {resenas.isPending || resenas.isError ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <MiResena contenidoId={id} resena={resenas.data.miResena ?? null} />
        )}
      </section>

      <section aria-labelledby="ficha-resenas" className="space-y-5">
        <h2 id="ficha-resenas" className="font-display text-2xl">
          {t("resenas.titulo")}
        </h2>
        {resenas.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : resenas.isError ? (
          <EstadoError
            mensaje={mensajeDeError(resenas.error)}
            onReintentar={() => void resenas.refetch()}
          />
        ) : resenas.data.items.length === 0 ? (
          <p className="text-niebla">{t("resenas.vacio")}</p>
        ) : (
          <>
            <ul className="space-y-4" aria-busy={resenas.isFetching || undefined}>
              {resenas.data.items.map((resena) => (
                <ResenaItem key={resena.id} resena={resena} />
              ))}
            </ul>
            <PaginacionBotones
              pagina={paginaResenas}
              total={resenas.data.total}
              tamano={TAMANO_RESENAS}
              onCambio={setPaginaResenas}
            />
          </>
        )}
      </section>

      <BarraAcciones id={id} titulo={titulo.titulo} />
      {titulo.generos[0] ? (
        <BandaExplora
          generoId={titulo.generos[0].id}
          generoNombre={titulo.generos[0].nombre}
          excluirId={titulo.id}
        />
      ) : null}
    </article>
  );
}
