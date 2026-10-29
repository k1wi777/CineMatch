"use client";

import { ESTADOS_BIBLIOTECA, type TipoContenido } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useGeneros } from "@/features/generos/generos";
import { mensajeDeError } from "@/shared/api";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { SkeletonCartel } from "@/shared/ui/skeleton";
import { TarjetaTitulo } from "@/shared/ui/tarjeta-titulo";
import { alternarGenero } from "@/features/catalogo/filtros";
import { useBiblioteca } from "./biblioteca";
import { FILTROS_BIBLIOTECA_POR_DEFECTO, type FiltrosBiblioteca } from "./filtros";
import { SelectorEstado } from "./selector-estado";

const TAMANO_PAGINA = 20;

// Mi biblioteca (FE-6.1): pestañas por estado con conteo, filtros por tipo y género, y orden.
export function PaginaBiblioteca() {
  const t = useTranslations("biblioteca");
  const id = useId();
  const [filtros, setFiltros] = useState<FiltrosBiblioteca>(FILTROS_BIBLIOTECA_POR_DEFECTO);
  const biblioteca = useBiblioteca(filtros);
  const generos = useGeneros();

  function cambiar(parcial: Partial<FiltrosBiblioteca>) {
    // Cualquier cambio de filtro vuelve a la primera página; cambiar de pestaña también.
    setFiltros((actual) => ({ ...actual, ...parcial, page: parcial.page ?? 1 }));
  }

  const conteos = biblioteca.data?.conteos;
  const tipos: { valor: TipoContenido | undefined; texto: string }[] = [
    { valor: undefined, texto: t("filtros.tipoTodos") },
    { valor: "pelicula", texto: t("filtros.peliculas") },
    { valor: "serie", texto: t("filtros.series") },
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        {conteos ? (
          <p className="text-sm text-niebla">{t("total", { total: conteos.total })}</p>
        ) : null}
      </header>

      <div
        role="tablist"
        aria-label={t("pestanas")}
        className="flex flex-wrap gap-2 border-b border-papel/10"
      >
        {ESTADOS_BIBLIOTECA.map((estado) => {
          const activa = filtros.estado === estado;
          return (
            <button
              key={estado}
              id={`${id}-tab-${estado}`}
              role="tab"
              type="button"
              aria-selected={activa}
              aria-controls={`${id}-panel`}
              onClick={() => cambiar({ estado })}
              className={`-mb-px border-b-2 px-2 pb-2 text-sm ${
                activa ? "border-luz text-papel" : "border-transparent text-niebla hover:text-papel"
              }`}
            >
              {t(`estado.${estado}`)}
              {conteos ? (
                <span className="ml-1.5 text-xs text-niebla">{conteos[estado]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-niebla">{t("filtros.tipo")}</legend>
          <div className="flex flex-wrap gap-2">
            {tipos.map((opcion) => (
              <button
                key={opcion.texto}
                type="button"
                aria-pressed={filtros.tipo === opcion.valor}
                onClick={() => cambiar({ tipo: opcion.valor })}
                className={`rounded-sm border px-3 py-1.5 text-sm ${
                  filtros.tipo === opcion.valor
                    ? "border-luz text-papel"
                    : "border-papel/20 text-niebla hover:text-papel"
                }`}
              >
                {opcion.texto}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-orden`} className="block text-sm text-niebla">
              {t("filtros.orden")}
            </label>
            <select
              id={`${id}-orden`}
              value={filtros.orden}
              onChange={(evento) => cambiar({ orden: evento.target.value as "fecha" | "titulo" })}
              className="rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm focus:border-luz focus:outline-none"
            >
              <option value="fecha">{t("filtros.ordenFecha")}</option>
              <option value="titulo">{t("filtros.ordenTitulo")}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => cambiar({ dir: filtros.dir === "asc" ? "desc" : "asc" })}
            className="rounded-sm border border-papel/20 px-3 py-2 text-sm hover:border-luz"
          >
            {filtros.dir === "asc" ? t("filtros.ascendente") : t("filtros.descendente")}
          </button>
        </div>
      </div>

      {generos.data ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-niebla">{t("filtros.generos")}</legend>
          <div className="flex flex-wrap gap-2">
            {generos.data.map((genero) => {
              const activo = filtros.generoIds.includes(genero.id);
              return (
                <button
                  key={genero.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    cambiar({ generoIds: alternarGenero(filtros.generoIds, genero.id) })
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
        </fieldset>
      ) : null}

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${filtros.estado}`}>
        {biblioteca.isPending ? (
          <div
            role="status"
            aria-label={t("cargando")}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
          >
            {Array.from({ length: 8 }, (_, indice) => (
              <SkeletonCartel key={indice} />
            ))}
          </div>
        ) : biblioteca.isError ? (
          <EstadoError
            mensaje={mensajeDeError(biblioteca.error)}
            onReintentar={() => void biblioteca.refetch()}
          />
        ) : biblioteca.data.items.length === 0 ? (
          <EstadoVacio
            titulo={t(`vacio.${filtros.estado}.titulo`)}
            texto={t(`vacio.${filtros.estado}.texto`)}
          />
        ) : (
          <>
            <ul
              className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4"
              aria-busy={biblioteca.isFetching || undefined}
            >
              {biblioteca.data.items.map((elemento) => (
                <li key={elemento.id} className="space-y-3">
                  <TarjetaTitulo
                    id={elemento.id}
                    titulo={elemento.titulo}
                    anio={elemento.anio}
                    posterUrl={elemento.posterUrl}
                    generos={elemento.generos.map((genero) => genero.nombre)}
                  />
                  <SelectorEstado
                    contenidoId={elemento.id}
                    estado={elemento.estado}
                    etiqueta={t("selector.cambiar", { titulo: elemento.titulo })}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PaginacionBotones
                pagina={filtros.page}
                total={biblioteca.data.total}
                tamano={TAMANO_PAGINA}
                onCambio={(pagina) => setFiltros((actual) => ({ ...actual, page: pagina }))}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
