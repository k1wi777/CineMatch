"use client";

import { ESTADOS_BIBLIOTECA, type EstadoBiblioteca } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { useCambiarEstadoBiblioteca } from "./biblioteca";

// Selector del estado de un título en la biblioteca. Se usa en la ficha y en las tarjetas.
// Al marcar «vista» ofrece calificar y reseñar.
export function SelectorEstado({
  contenidoId,
  estado,
  etiqueta,
}: {
  contenidoId: number;
  estado: EstadoBiblioteca | null | undefined;
  etiqueta?: string;
}) {
  const t = useTranslations("biblioteca");
  const id = useId();
  const cambiar = useCambiarEstadoBiblioteca(contenidoId);
  const [error, setError] = useState<string | null>(null);
  const [ofrecerResena, setOfrecerResena] = useState(false);

  function alCambiar(valor: string) {
    setError(null);
    const nuevo = valor === "" ? null : (valor as EstadoBiblioteca);
    setOfrecerResena(nuevo === "vista");
    cambiar.mutate(nuevo, { onError: (err) => setError(mensajeDeError(err)) });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-estado`} className="block text-sm text-niebla">
        {etiqueta ?? t("selector.etiqueta")}
      </label>
      <select
        id={`${id}-estado`}
        value={estado ?? ""}
        disabled={cambiar.isPending}
        onChange={(evento) => alCambiar(evento.target.value)}
        className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm focus:border-luz focus:outline-none"
      >
        <option value="">{t("selector.quitar")}</option>
        {ESTADOS_BIBLIOTECA.map((valor) => (
          <option key={valor} value={valor}>
            {t(`estado.${valor}`)}
          </option>
        ))}
      </select>
      {ofrecerResena ? (
        <p className="text-sm text-papel/85">
          {t("selector.ofrecerResena")}{" "}
          <Link
            href={`/catalogo/${contenidoId}#ficha-mi-resena`}
            className="underline hover:text-luz"
          >
            {t("selector.calificarResenar")}
          </Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-brasa">
          {error}
        </p>
      ) : null}
    </div>
  );
}
