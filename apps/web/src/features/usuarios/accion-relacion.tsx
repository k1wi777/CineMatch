"use client";

import type { RelacionUsuario } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { accionesDeRelacion, type AccionRelacion } from "./relacion";
import { useAccionRelacion } from "./usuarios";

// Botones según la relación con la sesión: agregar, aceptar o cancelar. Con verPerfil añade un enlace al perfil.
export function AccionRelacionUsuario({
  usuarioId,
  relacion,
  amistadId,
  verPerfil = false,
}: {
  usuarioId: number;
  relacion: RelacionUsuario;
  amistadId: number | null;
  verPerfil?: boolean;
}) {
  const t = useTranslations("usuarios");
  const accion = useAccionRelacion();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(tipo: AccionRelacion) {
    setError(null);
    if (tipo === "agregar") {
      accion.mutate({ tipo, usuarioId }, { onError: (err) => setError(mensajeDeError(err)) });
      return;
    }
    if (amistadId === null) return;
    accion.mutate({ tipo, amistadId }, { onError: (err) => setError(mensajeDeError(err)) });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {accionesDeRelacion(relacion).map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => ejecutar(tipo)}
            disabled={accion.isPending}
            className={`rounded-sm px-3 py-1.5 text-sm disabled:opacity-50 ${
              tipo === "agregar" || tipo === "aceptar"
                ? "bg-luz font-semibold text-sala"
                : "border border-papel/30"
            }`}
          >
            {t(`accion.${tipo}`)}
          </button>
        ))}
        {verPerfil ? (
          <Link
            href={`/usuarios/${usuarioId}`}
            className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz"
          >
            {t("accion.verPerfil")}
          </Link>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-brasa">
          {error}
        </p>
      ) : null}
    </div>
  );
}
