"use client";

import { useTranslations } from "next-intl";
import { useEstadoBiblioteca } from "@/features/biblioteca/biblioteca";
import { SelectorEstado } from "@/features/biblioteca/selector-estado";

// Barra de acciones de la ficha (FE-4.3): estado en la biblioteca y acciones de reseña y recomendación.
// Reseñar lleva al formulario (FE-5.1) y recomendar a la página de envío (FE-7.1).
export function BarraAcciones({ titulo, id }: { titulo: string; id: number }) {
  const t = useTranslations("ficha");
  const estado = useEstadoBiblioteca(id);

  return (
    <section
      aria-label={t("acciones.titulo", { titulo })}
      className="sticky bottom-0 z-30 border-t border-papel/10 bg-sala/95 py-4 backdrop-blur md:static md:rounded-sm md:border md:bg-butaca md:px-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="md:w-72">
          <SelectorEstado
            contenidoId={id}
            estado={estado.data}
            etiqueta={t("acciones.biblioteca")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#ficha-mi-resena"
            className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
          >
            {t("acciones.resenar")}
          </a>
          <a
            href={`/catalogo/${id}/recomendar`}
            className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
          >
            {t("acciones.recomendar")}
          </a>
        </div>
      </div>
    </section>
  );
}
