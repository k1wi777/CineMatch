"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useGeneros } from "@/features/generos/generos";
import { useValorDiferido } from "@/features/usuarios/usuarios";
import { mensajeDeError } from "@/shared/api";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Paginador } from "@/shared/ui/paginador";
import { SkeletonCartel } from "@/shared/ui/skeleton";
import { TarjetaTitulo } from "@/shared/ui/tarjeta-titulo";
import { alternarGenero, queryDeFiltros, type FiltrosCatalogo, type TipoFiltro } from "./filtros";
import { TAMANO_PAGINA_CATALOGO, useCatalogo } from "./catalogo";

// Catálogo (FE-4.1). Los filtros viven en la URL: el servidor los lee y los pasa aquí.
export function PaginaCatalogo({ filtros }: { filtros: FiltrosCatalogo }) {
  const t = useTranslations("catalogo");
  const id = useId();
  const router = useRouter();
  const catalogo = useCatalogo(filtros);
  const generos = useGeneros();

  // El texto se queda en local y solo cambia la URL tras una pausa, para no pedir una búsqueda por tecla.
  const [texto, setTexto] = useState(filtros.q);
  const diferido = useValorDiferido(texto.trim(), 300);
  useEffect(() => {
    if (diferido !== filtros.q) {
      router.replace(queryDeFiltros({ ...filtros, q: diferido, page: 1 }), { scroll: false });
    }
  }, [diferido, filtros, router]);

  function cambiar(nuevo: FiltrosCatalogo) {
    router.replace(queryDeFiltros(nuevo), { scroll: false });
  }

  const hayFiltros = filtros.q !== "" || filtros.tipo !== undefined || filtros.generoIds.length > 0;
  const tipos: { valor: TipoFiltro | undefined; texto: string }[] = [
    { valor: undefined, texto: t("tipo.todos") },
    { valor: "pelicula", texto: t("tipo.peliculas") },
    { valor: "serie", texto: t("tipo.series") },
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        {catalogo.data ? (
          <p aria-live="polite" className="text-sm text-niebla">
            {t("resultados", { total: catalogo.data.total })}
          </p>
        ) : null}
      </header>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-q`} className="block text-sm text-niebla">
            {t("buscar")}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            placeholder={t("buscarPlaceholder")}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none sm:max-w-md"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-niebla">{t("tipo.etiqueta")}</legend>
          <div className="flex flex-wrap gap-2">
            {tipos.map((opcion) => {
              const activo = filtros.tipo === opcion.valor;
              return (
                <button
                  key={opcion.texto}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiar({ ...filtros, tipo: opcion.valor, page: 1 })}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${
                    activo
                      ? "border-luz text-papel"
                      : "border-papel/20 text-niebla hover:text-papel"
                  }`}
                >
                  {opcion.texto}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-niebla">
            {t("generos.etiqueta")}
            {filtros.generoIds.length > 0
              ? ` · ${t("generos.elegidos", { total: filtros.generoIds.length })}`
              : ""}
          </legend>
          {generos.isError ? (
            <EstadoError mensaje={t("generos.error")} onReintentar={() => void generos.refetch()} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(generos.data ?? []).map((genero) => {
                const activo = filtros.generoIds.includes(genero.id);
                return (
                  <button
                    key={genero.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      cambiar({
                        ...filtros,
                        generoIds: alternarGenero(filtros.generoIds, genero.id),
                        page: 1,
                      })
                    }
                    className={`rounded-sm border px-2.5 py-1 text-sm ${
                      activo
                        ? "border-luz bg-telon text-papel"
                        : "border-papel/20 text-niebla hover:text-papel"
                    }`}
                  >
                    {genero.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {hayFiltros ? (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              cambiar({ q: "", tipo: undefined, generoIds: [], page: 1 });
            }}
            className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
          >
            {t("limpiar")}
          </button>
        ) : null}
      </div>

      {catalogo.isPending ? (
        <div
          role="status"
          aria-label={t("cargando")}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {Array.from({ length: 8 }, (_, indice) => (
            <SkeletonCartel key={indice} />
          ))}
        </div>
      ) : catalogo.isError ? (
        <EstadoError
          mensaje={mensajeDeError(catalogo.error)}
          onReintentar={() => void catalogo.refetch()}
        />
      ) : catalogo.data.items.length === 0 ? (
        <EstadoVacio
          titulo={t("vacioTitulo")}
          texto={t("vacioTexto")}
          accion={
            hayFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setTexto("");
                  cambiar({ q: "", tipo: undefined, generoIds: [], page: 1 });
                }}
                className="rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
              >
                {t("limpiar")}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul
            aria-busy={catalogo.isFetching || undefined}
            className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {catalogo.data.items.map((titulo) => (
              <li key={titulo.id}>
                <TarjetaTitulo
                  id={titulo.id}
                  titulo={titulo.titulo}
                  anio={titulo.anio}
                  posterUrl={titulo.posterUrl}
                  generos={titulo.generos.map((genero) => genero.nombre)}
                />
              </li>
            ))}
          </ul>
          <Paginador
            pagina={filtros.page}
            total={catalogo.data.total}
            tamano={TAMANO_PAGINA_CATALOGO}
            construirHref={(pagina) => queryDeFiltros({ ...filtros, page: pagina })}
          />
        </>
      )}
    </section>
  );
}
