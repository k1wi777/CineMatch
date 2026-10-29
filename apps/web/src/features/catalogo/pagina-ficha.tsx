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
import { BarraAcciones } from "./barra-acciones";
import { debeMostrarPromedioAmigos } from "./ficha-logica";
import { useEstadisticas, useFicha, useResenasTitulo } from "./ficha";
import { FormularioResena } from "@/features/resenas/formulario-resena";
import { ResenaItem } from "@/features/resenas/resena-item";

const TAMANO_RESENAS = 20;

// Ficha de un título (FE-4.2). La barra de acciones (FE-4.3) va al final, fija en móvil.
export function PaginaFicha({ id }: { id: number }) {
  const t = useTranslations("ficha");
  const ficha = useFicha(id);
  const estadisticas = useEstadisticas(id);
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
      <Link href="/catalogo" className="text-sm text-niebla hover:text-papel">
        {t("volver")}
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-40 shrink-0 self-start sm:w-56">
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
          <p className="text-sm text-niebla">
            {t(`tipo.${titulo.tipo}`)}
            {titulo.anio ? ` · ${titulo.anio}` : ""}
            {titulo.duracion ? ` · ${t("duracion", { minutos: titulo.duracion })}` : ""}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">{titulo.titulo}</h1>
          {titulo.director ? (
            <p className="text-papel/85">
              <span className="text-niebla">{t("director")}: </span>
              {titulo.director}
            </p>
          ) : null}
          {titulo.generos.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("generos")}>
              {titulo.generos.map((genero) => (
                <li key={genero.id}>
                  <Chip texto={genero.nombre} />
                </li>
              ))}
            </ul>
          ) : null}
          <section aria-labelledby="ficha-sinopsis" className="space-y-2">
            <h2 id="ficha-sinopsis" className="text-sm text-niebla">
              {t("sinopsis")}
            </h2>
            <p className="max-w-prose text-papel/85">{titulo.sinopsis ?? t("sinSinopsis")}</p>
          </section>
        </div>
      </header>

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

      <section aria-labelledby="ficha-mi-resena" className="space-y-4">
        <h2 id="ficha-mi-resena" className="font-display text-2xl">
          {t("miResena.titulo")}
        </h2>
        {resenas.isPending || resenas.isError ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {resenas.data.miResena ? (
              <ul className="space-y-4">
                <ResenaItem resena={resenas.data.miResena} />
              </ul>
            ) : (
              <p className="text-niebla">{t("miResena.vacio")}</p>
            )}
            <div className="rounded-sm border border-papel/10 p-4 md:p-6">
              {/* Sin clave: al guardar no se vuelve a montar, así el aviso de «guardada» sigue visible. */}
              <FormularioResena contenidoId={id} existente={resenas.data.miResena ?? null} />
            </div>
          </>
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
    </article>
  );
}
