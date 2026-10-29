"use client";

import type { Notificacion } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Avatar } from "@/shared/ui/avatar";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { hrefNotificacion, textoNotificacion } from "./textos";
import {
  useContadorNoLeidas,
  useMarcarLeida,
  useMarcarTodas,
  useNotificaciones,
} from "./notificaciones";

const TAMANO_PAGINA = 20;

// Centro de notificaciones (FE-8.2): lista paginada, filtro de no leídas y marcar como leídas.
export function CentroNotificaciones() {
  const t = useTranslations("notificaciones");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const notificaciones = useNotificaciones(soloNoLeidas, pagina);
  const noLeidas = useContadorNoLeidas().data ?? 0;
  const marcarLeida = useMarcarLeida();
  const marcarTodas = useMarcarTodas();
  const [error, setError] = useState<string | null>(null);

  function cambiarFiltro(valor: boolean) {
    setSoloNoLeidas(valor);
    setPagina(1);
  }

  function alAbrir(notificacion: Notificacion) {
    if (!notificacion.leida) {
      marcarLeida.mutate(notificacion.id);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl">{t("titulo")}</h1>
          <p className="text-sm text-niebla">{t("sinLeer", { total: noLeidas })}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            marcarTodas.mutate(undefined, { onError: (err) => setError(mensajeDeError(err)) });
          }}
          disabled={noLeidas === 0 || marcarTodas.isPending}
          className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz disabled:opacity-40"
        >
          {t("marcarTodas")}
        </button>
      </header>

      <div role="tablist" aria-label={t("titulo")} className="flex gap-6 border-b border-papel/10">
        {[
          { valor: false, texto: t("todas") },
          { valor: true, texto: t("sinLeerFiltro") },
        ].map((opcion) => (
          <button
            key={opcion.texto}
            role="tab"
            type="button"
            aria-selected={soloNoLeidas === opcion.valor}
            onClick={() => cambiarFiltro(opcion.valor)}
            className={`-mb-px border-b-2 pb-2 text-sm ${
              soloNoLeidas === opcion.valor
                ? "border-luz text-papel"
                : "border-transparent text-niebla hover:text-papel"
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {error}
        </p>
      ) : null}

      {notificaciones.isPending ? (
        <div role="status" aria-label={t("cargando")} className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notificaciones.isError ? (
        <EstadoError
          mensaje={mensajeDeError(notificaciones.error)}
          onReintentar={() => void notificaciones.refetch()}
        />
      ) : notificaciones.data.items.length === 0 ? (
        <EstadoVacio
          titulo={t(soloNoLeidas ? "vacio.sinLeerTitulo" : "vacio.titulo")}
          texto={t(soloNoLeidas ? "vacio.sinLeerTexto" : "vacio.texto")}
        />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={notificaciones.isFetching || undefined}>
            {notificaciones.data.items.map((notificacion) => (
              <li
                key={notificacion.id}
                className={`flex items-start gap-3 rounded-sm border p-4 ${
                  notificacion.leida ? "border-papel/10 bg-butaca" : "border-luz/50 bg-telon"
                }`}
              >
                {notificacion.origen ? (
                  <Avatar
                    nombre={notificacion.origen.username}
                    url={notificacion.origen.avatarUrl}
                    tamano={40}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={hrefNotificacion(notificacion)}
                    onClick={() => alAbrir(notificacion)}
                    className="block hover:text-luz"
                  >
                    {!notificacion.leida ? (
                      <span className="mr-2 text-xs font-semibold uppercase text-luz">
                        {t("nueva")}
                      </span>
                    ) : null}
                    {textoNotificacion(notificacion)}
                  </Link>
                  <time dateTime={notificacion.fechaCreacion} className="text-xs text-niebla">
                    {formatoFecha(notificacion.fechaCreacion, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                {!notificacion.leida ? (
                  <button
                    type="button"
                    onClick={() => marcarLeida.mutate(notificacion.id)}
                    disabled={marcarLeida.isPending}
                    className="shrink-0 rounded-sm border border-papel/30 px-2 py-1 text-xs hover:border-luz disabled:opacity-50"
                  >
                    {t("marcarLeida")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <PaginacionBotones
            pagina={pagina}
            total={notificaciones.data.total}
            tamano={TAMANO_PAGINA}
            onCambio={setPagina}
          />
        </>
      )}
    </section>
  );
}
