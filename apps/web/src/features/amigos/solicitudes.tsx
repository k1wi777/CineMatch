"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Avatar } from "@/shared/ui/avatar";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { useAccionAmistad, useSolicitudes } from "./amigos";

const TAMANO_PAGINA = 20;
type Pestana = "recibidas" | "enviadas";

// Solicitudes de amistad (FE-3.2): recibidas con aceptar o rechazar, enviadas con cancelar.
export function Solicitudes() {
  const t = useTranslations("amigos");
  const id = useId();
  const [pestana, setPestana] = useState<Pestana>("recibidas");
  const [paginaRecibidas, setPaginaRecibidas] = useState(1);
  const [paginaEnviadas, setPaginaEnviadas] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const recibidas = useSolicitudes("recibidas", paginaRecibidas);
  const enviadas = useSolicitudes("enviadas", paginaEnviadas);
  const accion = useAccionAmistad();

  const pestanas: { clave: Pestana; texto: string }[] = [
    { clave: "recibidas", texto: t("solicitudes.recibidas") },
    { clave: "enviadas", texto: t("solicitudes.enviadas") },
  ];

  function ejecutar(entrada: Parameters<typeof accion.mutate>[0]) {
    setError(null);
    accion.mutate(entrada, { onError: (err) => setError(mensajeDeError(err)) });
  }

  const consulta = pestana === "recibidas" ? recibidas : enviadas;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">{t("solicitudes.titulo")}</h1>
        <Link
          href="/amigos"
          className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("solicitudes.volver")}
        </Link>
      </header>

      <div
        role="tablist"
        aria-label={t("solicitudes.titulo")}
        className="flex gap-6 border-b border-papel/10"
      >
        {pestanas.map((item) => {
          const activa = pestana === item.clave;
          return (
            <button
              key={item.clave}
              id={`${id}-tab-${item.clave}`}
              role="tab"
              type="button"
              aria-selected={activa}
              aria-controls={`${id}-panel`}
              onClick={() => {
                setError(null);
                setPestana(item.clave);
              }}
              className={`-mb-px border-b-2 pb-2 text-sm ${
                activa ? "border-luz text-papel" : "border-transparent text-niebla hover:text-papel"
              }`}
            >
              {item.texto}
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${pestana}`}
        className="space-y-6"
      >
        {error ? (
          <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
            {error}
          </p>
        ) : null}

        {consulta.isPending ? (
          <div role="status" aria-label={t("solicitudes.cargando")} className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : consulta.isError ? (
          <EstadoError
            mensaje={t("solicitudes.error")}
            onReintentar={() => void consulta.refetch()}
          />
        ) : consulta.data.items.length === 0 ? (
          <EstadoVacio
            titulo={
              pestana === "recibidas"
                ? t("solicitudes.vacioRecibidas")
                : t("solicitudes.vacioEnviadas")
            }
            texto={t("solicitudes.vacioTexto")}
          />
        ) : (
          <>
            <ul className="space-y-3" aria-busy={consulta.isFetching || undefined}>
              {consulta.data.items.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="flex flex-col gap-3 rounded-sm border border-papel/10 bg-butaca p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      nombre={solicitud.usuario.nombre}
                      url={solicitud.usuario.avatarUrl}
                      tamano={44}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/usuarios/${solicitud.usuario.id}`}
                        className="block truncate font-medium hover:text-luz"
                      >
                        {solicitud.usuario.nombre}
                      </Link>
                      <p className="truncate text-sm text-niebla">@{solicitud.usuario.username}</p>
                      <p className="text-xs text-papel/70">
                        {t(
                          pestana === "recibidas"
                            ? "solicitudes.recibidaEl"
                            : "solicitudes.enviadaEl",
                          {
                            fecha: formatoFecha(solicitud.fechaSolicitud),
                          },
                        )}
                      </p>
                    </div>
                  </div>

                  {pestana === "recibidas" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => ejecutar({ tipo: "aceptar", solicitudId: solicitud.id })}
                        disabled={accion.isPending}
                        className="rounded-sm bg-luz px-3 py-1.5 text-sm font-semibold text-sala disabled:opacity-50"
                      >
                        {t("solicitudes.aceptar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => ejecutar({ tipo: "rechazar", solicitudId: solicitud.id })}
                        disabled={accion.isPending}
                        className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        {t("solicitudes.rechazar")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => ejecutar({ tipo: "cancelar", solicitudId: solicitud.id })}
                      disabled={accion.isPending}
                      className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-brasa hover:text-brasa disabled:opacity-50"
                    >
                      {t("solicitudes.cancelar")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <PaginacionBotones
              pagina={pestana === "recibidas" ? paginaRecibidas : paginaEnviadas}
              total={consulta.data.total}
              tamano={TAMANO_PAGINA}
              onCambio={pestana === "recibidas" ? setPaginaRecibidas : setPaginaEnviadas}
            />
          </>
        )}
      </div>
    </section>
  );
}
