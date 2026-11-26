"use client";

import type { RecomendacionDetalle } from "@cinematch/shared";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useSesion } from "@/features/auth/sesion";
import { useEstadoBiblioteca } from "@/features/biblioteca/biblioteca";
import { SelectorEstado } from "@/features/biblioteca/selector-estado";
import { useEstadisticas, useLogo } from "@/features/catalogo/ficha";
import { comentarioVisible } from "@/features/catalogo/ficha-logica";
import { ApiError, mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { accionesDelReceptor, puedeVerResenaReceptor } from "./estado";
import { useAccionRecomendacion, useRecomendacion } from "./bandeja";

// Detalle de una recomendación (FE-7.3). Abrirla la marca como abierta (lo hace la API).
// Solo emisor y receptor la ven: para terceros la API responde 404.
export function PaginaDetalleRecomendacion({ id }: { id: number }) {
  const t = useTranslations("recomendaciones");
  const sesion = useSesion();
  const detalle = useRecomendacion(id);
  const accion = useAccionRecomendacion(id);
  const [error, setError] = useState<string | null>(null);

  const contenidoId = detalle.data?.contenido.id ?? 0;
  const logo = useLogo(contenidoId);
  const estadoBiblioteca = useEstadoBiblioteca(contenidoId);
  const estadisticas = useEstadisticas(contenidoId);

  if (detalle.isPending) {
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detalle.isError) {
    if (detalle.error instanceof ApiError && detalle.error.status === 404) {
      return (
        <section className="space-y-4">
          <EstadoVacio titulo={t("noEncontrada.titulo")} texto={t("noEncontrada.texto")} />
          <Link
            href="/recomendaciones"
            className="block text-center text-sm text-niebla hover:text-papel"
          >
            {t("volverBandeja")}
          </Link>
        </section>
      );
    }
    return (
      <EstadoError
        mensaje={mensajeDeError(detalle.error)}
        onReintentar={() => void detalle.refetch()}
      />
    );
  }

  const r = detalle.data;
  const soyReceptor = sesion.data?.id === r.receptor.id;
  const acciones = soyReceptor ? accionesDelReceptor(r.estado) : [];

  function ejecutar(tipo: "aceptar" | "descartar") {
    setError(null);
    accion.mutate(tipo, { onError: (err) => setError(mensajeDeError(err)) });
  }

  return (
    <article className="space-y-10">
      <Link href="/recomendaciones" className="text-sm text-niebla hover:text-papel">
        {t("volverBandeja")}
      </Link>

      <header className="relative isolate space-y-3 py-8 md:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
        >
          {r.contenido.posterUrl ? (
            <Image
              src={r.contenido.posterUrl}
              alt=""
              fill
              sizes="100vw"
              className="scale-110 object-cover opacity-50 blur-2xl"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-sala/80 via-sala/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-sala to-transparent" />
        </div>
        <p className="text-sm text-niebla">
          {soyReceptor
            ? t("deUsuario", { usuario: r.emisor.username })
            : t("paraUsuario", { usuario: r.receptor.username })}
          {" · "}
          {formatoFecha(r.fechaEnvio)}
        </p>
        <h1 className="font-display text-3xl">
          <Link href={`/catalogo/${r.contenido.id}`} className="hover:text-luz">
            {r.contenido.titulo}
          </Link>
        </h1>
      </header>

      {r.motivo ? (
        <blockquote className="border-l-2 border-luz pl-4 text-papel/85">
          <p className="whitespace-pre-line">{r.motivo}</p>
        </blockquote>
      ) : null}

      <section aria-label="Detalle del título" className="grid gap-6 md:grid-cols-2">
        <div className="relative min-h-56 overflow-hidden rounded-md border border-papel/10 bg-butaca md:row-start-1 md:col-start-1">
          {r.contenido.fondoUrl ? (
            <Image
              src={r.contenido.fondoUrl}
              alt={r.contenido.titulo}
              fill
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-6 rounded-md border border-papel/10 bg-butaca p-5 md:row-start-1 md:col-start-2 md:p-6">
          {(logo.data?.url ?? r.contenido.logoUrl) ? (
            <div className="relative h-16 w-full max-w-xs">
              <Image
                src={(logo.data?.url ?? r.contenido.logoUrl) as string}
                alt={r.contenido.titulo}
                fill
                sizes="320px"
                className="object-contain object-left"
              />
            </div>
          ) : (
            <p className="font-display text-2xl">{r.contenido.titulo}</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <dt className="text-niebla">Recomendada por</dt>
              <dd className="text-papel">@{r.emisor.username}</dd>
            </div>
            <div>
              <dt className="text-niebla">Enviada el</dt>
              <dd className="text-papel">{formatoFecha(r.fechaEnvio)}</dd>
            </div>
            <div>
              <dt className="text-niebla">Estado</dt>
              <dd className="text-papel">{t(`estado.${r.estado}`)}</dd>
            </div>
            <div>
              <dt className="text-niebla">Tus intereses</dt>
              <dd className="text-papel">{r.fueraDeIntereses ? "Fuera de ellos" : "Coinciden"}</dd>
            </div>

            {r.contenido.director ? (
              <div>
                <dt className="text-niebla">Director</dt>
                <dd className="text-papel">{r.contenido.director}</dd>
              </div>
            ) : null}
            {r.contenido.duracion ? (
              <div>
                <dt className="text-niebla">Duración</dt>
                <dd className="text-papel">{r.contenido.duracion} min</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 md:items-end">
        <>
          <section aria-labelledby={`rec-${id}-acciones`} className="space-y-3">
            <h2 id={`rec-${id}-acciones`} className="text-sm text-niebla">
              {t("acciones")}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {acciones.includes("aceptar") ? (
                <button
                  type="button"
                  onClick={() => ejecutar("aceptar")}
                  disabled={accion.isPending}
                  className="rounded-sm bg-luz px-3 py-2 text-sm font-semibold text-sala disabled:opacity-50 whitespace-nowrap"
                >
                  {t("agregarPendientes")}
                </button>
              ) : null}
              {acciones.includes("descartar") ? (
                <button
                  type="button"
                  onClick={() => ejecutar("descartar")}
                  disabled={accion.isPending}
                  className="rounded-sm border border-papel/30 px-3 py-2 text-sm hover:border-brasa disabled:opacity-50 whitespace-nowrap"
                >
                  {t("noMeInteresa")}
                </button>
              ) : null}
              <Link
                href={`/catalogo/${r.contenido.id}`}
                className="rounded-sm border border-papel/30 px-3 py-2 text-sm hover:border-luz whitespace-nowrap"
              >
                {t("verTitulo")}
              </Link>
              {soyReceptor ? (
                <Link
                  href={`/catalogo/${r.contenido.id}#ficha-mi-resena`}
                  className="rounded-sm border border-papel/30 px-3 py-2 text-sm hover:border-luz whitespace-nowrap"
                >
                  {t("calificar")}
                </Link>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-brasa">
                {error}
              </p>
            ) : null}
          </section>
        </>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1.5fr]">
          {r.contenido.tipo ? (
            <span className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-sm border border-papel/15 bg-butaca px-3 text-sm text-papel">
              {r.contenido.tipo === "pelicula" ? "Película" : "Serie"}
            </span>
          ) : null}
          {r.contenido.anio ? (
            <span className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-sm border border-papel/15 bg-butaca px-3 text-sm text-papel">
              Año {r.contenido.anio}
            </span>
          ) : null}
          <span className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-sm border border-papel/15 bg-butaca px-3 text-sm text-papel">
            {estadisticas.data?.promedioPublico != null
              ? `Comunidad ${estadisticas.data.promedioPublico.toFixed(1).replace(".", ",")}`
              : "Sin calificaciones"}
          </span>
          <div className="[&_label]:sr-only [&_select]:h-10 [&_select]:w-full">
            <SelectorEstado
              contenidoId={r.contenido.id}
              estado={estadoBiblioteca.data}
              etiqueta="En mi biblioteca"
            />
          </div>
        </div>
      </div>

      <section aria-labelledby={`rec-${id}-resena`} className="space-y-4">
        <h2 id={`rec-${id}-resena`} className="font-display text-2xl">
          {t("resenaAdjunta")}
        </h2>
        {r.resenaAdjunta ? (
          <ResenaVista resena={r.resenaAdjunta} />
        ) : (
          <p className="text-niebla">{t("sinResenaAdjunta")}</p>
        )}
      </section>

      {puedeVerResenaReceptor(r.estado) && r.resenaReceptor ? (
        <section aria-labelledby={`rec-${id}-receptor`} className="space-y-4">
          <h2 id={`rec-${id}-receptor`} className="font-display text-2xl">
            {t("resenaReceptor", { usuario: r.receptor.username })}
          </h2>
          <ResenaVista resena={r.resenaReceptor} />
        </section>
      ) : null}
    </article>
  );
}

// Reseña tal como la puede ver quien consulta (la API ya aplica la visibilidad).
function ResenaVista({ resena }: { resena: NonNullable<RecomendacionDetalle["resenaAdjunta"]> }) {
  const t = useTranslations("recomendaciones");
  const [revelado, setRevelado] = useState(false);
  const visible = comentarioVisible(resena.esSpoiler, revelado);
  return (
    <div className="space-y-3 rounded-sm border border-papel/10 bg-butaca p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Estrellas valor={resena.calificacion} etiqueta={t("calificacion")} />
        {resena.etiquetas.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("etiquetas")}>
            {resena.etiquetas.map((etiqueta) => (
              <li key={etiqueta}>
                <Chip texto={etiqueta} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {resena.comentario ? (
        visible ? (
          <p className="whitespace-pre-line text-papel/85">{resena.comentario}</p>
        ) : (
          <div className="space-y-2 rounded-sm border border-brasa/60 p-3">
            <p className="text-sm text-papel/85">{t("spoilerAviso")}</p>
            <button
              type="button"
              onClick={() => setRevelado(true)}
              className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz"
            >
              {t("mostrarSpoiler")}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
