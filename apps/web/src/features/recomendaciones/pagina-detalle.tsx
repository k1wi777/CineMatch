"use client";

import type { RecomendacionDetalle } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useSesion } from "@/features/auth/sesion";
import { comentarioVisible } from "@/features/catalogo/ficha-logica";
import { ApiError, mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Insignia } from "@/shared/ui/insignia";
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

      <header className="space-y-3">
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
        <div className="flex flex-wrap gap-2">
          <Insignia texto={t(`estado.${r.estado}`)} tono="luz" />
          {r.fueraDeIntereses ? <Insignia texto={t("fueraDeIntereses")} tono="neutro" /> : null}
        </div>
      </header>

      {r.motivo ? (
        <blockquote className="border-l-2 border-luz pl-4 text-papel/85">
          <p className="whitespace-pre-line">{r.motivo}</p>
        </blockquote>
      ) : null}

      {acciones.length > 0 ? (
        <section aria-labelledby={`rec-${id}-acciones`} className="space-y-3">
          <h2 id={`rec-${id}-acciones`} className="text-sm text-niebla">
            {t("acciones")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {acciones.includes("aceptar") ? (
              <button
                type="button"
                onClick={() => ejecutar("aceptar")}
                disabled={accion.isPending}
                className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala disabled:opacity-50"
              >
                {t("agregarPendientes")}
              </button>
            ) : null}
            {acciones.includes("descartar") ? (
              <button
                type="button"
                onClick={() => ejecutar("descartar")}
                disabled={accion.isPending}
                className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-brasa disabled:opacity-50"
              >
                {t("noMeInteresa")}
              </button>
            ) : null}
            <Link
              href={`/catalogo/${r.contenido.id}`}
              className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
            >
              {t("verTitulo")}
            </Link>
            {soyReceptor ? (
              <Link
                href={`/catalogo/${r.contenido.id}#ficha-mi-resena`}
                className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
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
      ) : null}

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
