"use client";

import { RECOMMENDATION_STATUSES, type RecommendationStatus } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { formatoFecha } from "@/shared/formato";
import { mensajeDeError } from "@/shared/api";
import { Avatar } from "@/shared/ui/avatar";
import { Insignia, type TonoInsignia } from "@/shared/ui/insignia";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { useEnviadas, useRecibidas } from "./bandeja";

const TAMANO_PAGINA = 20;
type Pestana = "recibidas" | "enviadas";

const TONO_ESTADO: Record<RecommendationStatus, TonoInsignia> = {
  enviada: "luz",
  abierta: "neutro",
  aceptada: "exito",
  descartada: "error",
  completada: "exito",
};

// Recomendaciones (FE-7.2 y FE-7.4): recibidas con filtro por estado, y enviadas.
export function PaginaBandeja() {
  const t = useTranslations("recomendaciones");
  const idBase = useId();
  const [pestana, setPestana] = useState<Pestana>("recibidas");
  const [estado, setEstado] = useState<RecommendationStatus | undefined>(undefined);
  const [pagina, setPagina] = useState(1);

  const recibidas = useRecibidas(estado, pestana === "recibidas" ? pagina : 1);
  const enviadas = useEnviadas(pestana === "enviadas" ? pagina : 1);
  const consulta = pestana === "recibidas" ? recibidas : enviadas;

  function cambiarPestana(nueva: Pestana) {
    setPestana(nueva);
    setPagina(1);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
      </header>

      <div role="tablist" aria-label={t("titulo")} className="flex gap-6 border-b border-papel/10">
        {(["recibidas", "enviadas"] as const).map((clave) => (
          <button
            key={clave}
            id={`${idBase}-tab-${clave}`}
            role="tab"
            type="button"
            aria-selected={pestana === clave}
            aria-controls={`${idBase}-panel`}
            onClick={() => cambiarPestana(clave)}
            className={`-mb-px border-b-2 pb-2 text-sm ${
              pestana === clave
                ? "border-luz text-papel"
                : "border-transparent text-niebla hover:text-papel"
            }`}
          >
            {t(`pestanas.${clave}`)}
          </button>
        ))}
      </div>

      <div id={`${idBase}-panel`} role="tabpanel" className="space-y-6">
        {pestana === "recibidas" ? (
          <div className="space-y-1.5">
            <label htmlFor={`${idBase}-estado`} className="block text-sm text-niebla">
              {t("filtroEstado")}
            </label>
            <select
              id={`${idBase}-estado`}
              value={estado ?? ""}
              onChange={(evento) => {
                setEstado((evento.target.value || undefined) as RecommendationStatus | undefined);
                setPagina(1);
              }}
              className="rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm focus:border-luz focus:outline-none"
            >
              <option value="">{t("todos")}</option>
              {RECOMMENDATION_STATUSES.map((valor) => (
                <option key={valor} value={valor}>
                  {t(`estado.${valor}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {consulta.isPending ? (
          <div role="status" aria-label={t("cargando")} className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : consulta.isError ? (
          <EstadoError
            mensaje={mensajeDeError(consulta.error)}
            onReintentar={() => void consulta.refetch()}
          />
        ) : consulta.data.items.length === 0 ? (
          <EstadoVacio
            titulo={t(pestana === "recibidas" ? "vacioRecibidas.titulo" : "vacioEnviadas.titulo")}
            texto={t(pestana === "recibidas" ? "vacioRecibidas.texto" : "vacioEnviadas.texto")}
            accion={
              <Link
                href="/catalogo"
                className="inline-block rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
              >
                {t("explorar")}
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-3" aria-busy={consulta.isFetching || undefined}>
              {consulta.data.items.map((item) => {
                const persona = pestana === "recibidas" ? item.emisor : item.receptor;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-sm border border-papel/10 bg-butaca p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar nombre={persona.username} url={persona.avatarUrl} tamano={44} />
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/recomendaciones/${item.id}`}
                          className="block truncate font-medium hover:text-luz"
                        >
                          {item.contenido.titulo}
                        </Link>
                        <p className="truncate text-sm text-niebla">
                          {t(pestana === "recibidas" ? "de" : "para", {
                            usuario: persona.username,
                          })}
                          {" · "}
                          {formatoFecha(item.fechaEnvio)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Insignia
                            texto={t(`estado.${item.estado}`)}
                            tono={TONO_ESTADO[item.estado]}
                          />
                          {item.fueraDeIntereses ? (
                            <Insignia texto={t("fueraDeIntereses")} tono="neutro" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/recomendaciones/${item.id}`}
                      className="self-start rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz sm:self-center"
                    >
                      {t("ver")}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <PaginacionBotones
              pagina={pagina}
              total={consulta.data.total}
              tamano={TAMANO_PAGINA}
              onCambio={setPagina}
            />
          </>
        )}
      </div>
    </section>
  );
}
