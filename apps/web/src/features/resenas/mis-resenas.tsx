"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { ResenaItem } from "./resena-item";
import { useMisResenas } from "./resenas";

const TAMANO_PAGINA = 20;

// Mis reseñas (FE-5.3): todas las propias, también las ocultas por moderación (con su aviso).
export function MisResenas() {
  const t = useTranslations("resenas");
  const [pagina, setPagina] = useState(1);
  const resenas = useMisResenas(pagina);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">{t("mis.titulo")}</h1>
        {resenas.data ? (
          <p className="text-sm text-niebla">{t("mis.total", { total: resenas.data.total })}</p>
        ) : null}
      </header>

      {resenas.isPending ? (
        <div role="status" aria-label={t("mis.cargando")} className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : resenas.isError ? (
        <EstadoError
          mensaje={mensajeDeError(resenas.error)}
          onReintentar={() => void resenas.refetch()}
        />
      ) : resenas.data.items.length === 0 ? (
        <EstadoVacio
          titulo={t("mis.vacioTitulo")}
          texto={t("mis.vacioTexto")}
          accion={
            <Link
              href="/catalogo"
              className="inline-block rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
            >
              {t("mis.irCatalogo")}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-4" aria-busy={resenas.isFetching || undefined}>
            {resenas.data.items.map((resena) => (
              <ResenaItem key={resena.id} resena={resena} />
            ))}
          </ul>
          <PaginacionBotones
            pagina={pagina}
            total={resenas.data.total}
            tamano={TAMANO_PAGINA}
            onCambio={setPagina}
          />
        </>
      )}
    </section>
  );
}
