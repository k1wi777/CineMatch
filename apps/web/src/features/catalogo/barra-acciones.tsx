"use client";

import { ESTADOS_BIBLIOTECA, type EstadoBiblioteca } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { useCambiarEstadoBiblioteca, useEstadoBiblioteca } from "./ficha";

// Barra de acciones de la ficha (FE-4.3): estado en la biblioteca y acciones de reseña y recomendación.
// Reseñar y recomendar llegan con FE-5.1 y FE-7.1; mientras, aparecen como próximamente.
export function BarraAcciones({ titulo, id }: { titulo: string; id: number }) {
  const t = useTranslations("ficha");
  const idBase = useId();
  const estado = useEstadoBiblioteca(id);
  const cambiar = useCambiarEstadoBiblioteca(id);
  const [error, setError] = useState<string | null>(null);

  function alCambiar(valor: string) {
    setError(null);
    const nuevo = valor === "" ? null : (valor as EstadoBiblioteca);
    cambiar.mutate(nuevo, { onError: (err) => setError(mensajeDeError(err)) });
  }

  return (
    <section
      aria-label={t("acciones.titulo", { titulo })}
      className="sticky bottom-0 z-30 border-t border-papel/10 bg-sala/95 py-4 backdrop-blur md:static md:rounded-sm md:border md:bg-butaca md:px-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-estado`} className="block text-sm text-niebla">
            {t("acciones.biblioteca")}
          </label>
          <select
            id={`${idBase}-estado`}
            value={estado.data ?? ""}
            disabled={estado.isPending || cambiar.isPending}
            onChange={(evento) => alCambiar(evento.target.value)}
            className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none md:w-56"
          >
            <option value="">{t("acciones.sinEstado")}</option>
            {ESTADOS_BIBLIOTECA.map((valor) => (
              <option key={valor} value={valor}>
                {t(`estado.${valor}`)}
              </option>
            ))}
          </select>
          {error ? (
            <p role="alert" className="text-sm text-brasa">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            aria-describedby={`${idBase}-proximamente`}
            className="rounded-sm border border-papel/20 px-4 py-2 text-sm text-niebla disabled:cursor-not-allowed"
          >
            {t("acciones.resenar")}
          </button>
          <button
            type="button"
            disabled
            aria-describedby={`${idBase}-proximamente`}
            className="rounded-sm border border-papel/20 px-4 py-2 text-sm text-niebla disabled:cursor-not-allowed"
          >
            {t("acciones.recomendar")}
          </button>
          <span id={`${idBase}-proximamente`} className="self-center text-xs text-niebla">
            {t("acciones.proximamente")}
          </span>
        </div>
      </div>
    </section>
  );
}
