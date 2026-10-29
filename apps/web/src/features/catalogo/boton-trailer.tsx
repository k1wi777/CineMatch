"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { EstadoError } from "@/shared/ui/estados";
import { useTrailer } from "./ficha";
import { claveYoutube, urlEmbebida } from "./trailer-logica";

// Botón que abre el tráiler en un diálogo nativo (foco atrapado, Escape cierra y el fondo queda bloqueado).
// El enlace se pide a la API solo al abrir; el video se reproduce desde YouTube.
export function BotonTrailer({ id, titulo }: { id: number; titulo: string }) {
  const t = useTranslations("ficha.trailer");
  const tituloId = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const trailer = useTrailer(id, abierto);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  const enlace = trailer.data?.url ?? null;
  const clave = enlace ? claveYoutube(enlace) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-papel"
      >
        {t("ver")}
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        onClose={() => setAbierto(false)}
        className="m-auto w-[min(56rem,calc(100%-2rem))] space-y-4 rounded-sm border border-papel/15 bg-butaca p-4 text-papel backdrop:bg-sala/90 md:p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={tituloId} className="font-display text-xl">
            {t("titulo", { titulo })}
          </h2>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="rounded-sm border border-papel/30 px-3 py-1 text-sm hover:border-papel"
          >
            {t("cerrar")}
          </button>
        </div>

        {trailer.isPending ? (
          <p role="status" className="text-niebla">
            {t("cargando")}
          </p>
        ) : trailer.isError ? (
          <EstadoError
            mensaje={mensajeDeError(trailer.error)}
            onReintentar={() => void trailer.refetch()}
          />
        ) : clave ? (
          <div className="space-y-3">
            <iframe
              src={urlEmbebida(clave)}
              title={t("titulo", { titulo })}
              allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full rounded-sm"
            />
            <a
              href={enlace ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-niebla underline underline-offset-4 hover:text-papel"
            >
              {t("verEnYoutube")}
            </a>
          </div>
        ) : (
          <p className="text-niebla">{t("sinTrailer")}</p>
        )}
      </dialog>
    </>
  );
}
