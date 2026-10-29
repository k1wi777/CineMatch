"use client";

import type { TipoContenido } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useGeneros } from "@/features/generos/generos";
import { mensajeDeError } from "@/shared/api";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { SkeletonCartel } from "@/shared/ui/skeleton";
import { useRecomendacionesComunidad } from "./comunidad";
import { TarjetaComunidad } from "./tarjeta-comunidad";

const TAMANO_PAGINA = 20;

// Recomendaciones generales (FE-9.1): filtro por género y tipo. Ya excluyen lo que viste.
export function PaginaComunidad() {
  const t = useTranslations("comunidad");
  const idBase = useId();
  const [generoId, setGeneroId] = useState<number | undefined>(undefined);
  const [tipo, setTipo] = useState<TipoContenido | undefined>(undefined);
  const [pagina, setPagina] = useState(1);
  const generos = useGeneros();
  const recomendaciones = useRecomendacionesComunidad({
    generoId,
    tipo,
    page: pagina,
    pageSize: TAMANO_PAGINA,
  });

  function cambiar(cambios: { generoId?: number; tipo?: TipoContenido }) {
    if ("generoId" in cambios) setGeneroId(cambios.generoId);
    if ("tipo" in cambios) setTipo(cambios.tipo);
    setPagina(1);
  }

  const opcionesTipo: { valor: TipoContenido | undefined; texto: string }[] = [
    { valor: undefined, texto: t("tipoTodos") },
    { valor: "pelicula", texto: t("peliculas") },
    { valor: "serie", texto: t("series") },
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        <p className="max-w-prose text-papel/70">{t("ayuda")}</p>
      </header>

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-niebla">{t("tipo")}</legend>
          <div className="flex flex-wrap gap-2">
            {opcionesTipo.map((opcion) => (
              <button
                key={opcion.texto}
                type="button"
                aria-pressed={tipo === opcion.valor}
                onClick={() => cambiar({ tipo: opcion.valor })}
                className={`rounded-sm border px-3 py-1.5 text-sm ${
                  tipo === opcion.valor
                    ? "border-luz text-papel"
                    : "border-papel/20 text-niebla hover:text-papel"
                }`}
              >
                {opcion.texto}
              </button>
            ))}
          </div>
        </fieldset>

        {generos.data ? (
          <div className="space-y-1.5">
            <label htmlFor={`${idBase}-genero`} className="block text-sm text-niebla">
              {t("genero")}
            </label>
            <select
              id={`${idBase}-genero`}
              value={generoId ?? ""}
              onChange={(evento) =>
                cambiar({ generoId: evento.target.value ? Number(evento.target.value) : undefined })
              }
              className="rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm focus:border-luz focus:outline-none"
            >
              <option value="">{t("todosGeneros")}</option>
              {generos.data.map((genero) => (
                <option key={genero.id} value={genero.id}>
                  {genero.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {recomendaciones.isPending ? (
        <div
          role="status"
          aria-label={t("cargando")}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, indice) => (
            <SkeletonCartel key={indice} />
          ))}
        </div>
      ) : recomendaciones.isError ? (
        <EstadoError
          mensaje={mensajeDeError(recomendaciones.error)}
          onReintentar={() => void recomendaciones.refetch()}
        />
      ) : recomendaciones.data.items.length === 0 ? (
        <EstadoVacio titulo={t("vacioTitulo")} texto={t("vacioTexto")} />
      ) : (
        <>
          <ul
            className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4"
            aria-busy={recomendaciones.isFetching || undefined}
          >
            {recomendaciones.data.items.map((titulo) => (
              <li key={titulo.id}>
                <TarjetaComunidad titulo={titulo} />
              </li>
            ))}
          </ul>
          <PaginacionBotones
            pagina={pagina}
            total={recomendaciones.data.total}
            tamano={TAMANO_PAGINA}
            onCambio={setPagina}
          />
        </>
      )}
    </section>
  );
}
