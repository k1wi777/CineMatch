"use client";

import type { ResenaLista } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { formatoFecha } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { comentarioVisible } from "./ficha-logica";

// Una reseña: calificación y etiquetas antes del comentario. Un spoiler pide confirmación para verlo.
export function ResenaItem({ resena }: { resena: ResenaLista }) {
  const t = useTranslations("ficha");
  const [revelado, setRevelado] = useState(false);
  const visible = comentarioVisible(resena.esSpoiler, revelado);

  return (
    <li className="space-y-3 rounded-sm border border-papel/10 bg-butaca p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {resena.autor.eliminado ? (
          <span className="text-niebla">{t("resenas.usuarioEliminado")}</span>
        ) : (
          <Link href={`/usuarios/${resena.autor.id}`} className="font-medium hover:text-luz">
            @{resena.autor.username}
          </Link>
        )}
        <time dateTime={resena.fechaCreacion} className="text-xs text-niebla">
          {formatoFecha(resena.fechaCreacion)}
        </time>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Estrellas valor={resena.calificacion} etiqueta={t("resenas.calificacion")} />
        {resena.etiquetas.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("resenas.etiquetas")}>
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
            <p className="text-sm text-papel/85">{t("resenas.spoilerAviso")}</p>
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setRevelado(true)}
              className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz"
            >
              {t("resenas.mostrarSpoiler")}
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}
