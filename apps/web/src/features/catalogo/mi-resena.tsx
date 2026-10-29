"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FormularioResena } from "@/features/resenas/formulario-resena";
import { ResenaItem } from "@/features/resenas/resena-item";
import type { ResenaLista } from "@cinematch/shared";

const ANCLA_FORMULARIO = "#ficha-formulario-resena";

// Sección «Mi reseña» de la ficha. Tres casos:
// - sin reseña: texto y botón «Añadir reseña», que abre el formulario;
// - con reseña: la tarjeta con «Editar» y «Eliminar»; «Editar» abre el formulario con tus datos;
// - formulario abierto: se guarda y, con «Cancelar», se vuelve a la vista anterior.
export function MiResena({
  contenidoId,
  resena,
}: {
  contenidoId: number;
  resena: ResenaLista | null;
}) {
  const t = useTranslations("ficha.miResena");
  const [abierto, setAbierto] = useState(false);
  const formularioVisible = abierto || resena === null;

  // Si se llega con el ancla del formulario (desde «Mis reseñas»), el formulario se abre directamente.
  useEffect(() => {
    if (window.location.hash === ANCLA_FORMULARIO) setAbierto(true);
  }, []);

  return (
    <div className="space-y-5">
      {resena && !formularioVisible ? (
        <ul className="space-y-4">
          <ResenaItem resena={resena} alEditar={() => setAbierto(true)} />
        </ul>
      ) : null}

      {resena === null && !formularioVisible ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-papel/10 bg-butaca p-4 md:p-6">
          <p className="text-niebla">{t("vacio")}</p>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
          >
            {t("anadir")}
          </button>
        </div>
      ) : null}

      {formularioVisible ? (
        <div
          id="ficha-formulario-resena"
          className="rounded-sm border border-papel/10 bg-butaca p-4 md:p-6"
        >
          <FormularioResena
            contenidoId={contenidoId}
            existente={resena}
            alCancelar={() => setAbierto(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
