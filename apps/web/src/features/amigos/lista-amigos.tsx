"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { Avatar } from "@/shared/ui/avatar";
import { ModalConfirmacion } from "@/shared/ui/modal-confirmacion";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { useAccionAmistad, useAmigos } from "./amigos";

const TAMANO_PAGINA = 20;

// Mis amigos (FE-3.1). Eliminar una amistad pide confirmación en un modal.
export function ListaAmigos() {
  const t = useTranslations("amigos");
  const [pagina, setPagina] = useState(1);
  const [aEliminar, setAEliminar] = useState<{ amistadId: number; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amigos = useAmigos(pagina);
  const accion = useAccionAmistad();

  function confirmarEliminacion() {
    if (!aEliminar || accion.isPending) return;
    setError(null);
    accion.mutate(
      { tipo: "eliminar", amistadId: aEliminar.amistadId },
      {
        onSuccess: () => setAEliminar(null),
        onError: (err) => {
          setAEliminar(null);
          setError(mensajeDeError(err));
        },
      },
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">{t("lista.titulo")}</h1>
        <nav aria-label={t("lista.navegacion")} className="flex gap-4 text-sm">
          <Link
            href="/amigos/solicitudes"
            className="text-niebla underline underline-offset-4 hover:text-papel"
          >
            {t("lista.solicitudes")}
          </Link>
          <Link
            href="/amigos/buscar"
            className="text-niebla underline underline-offset-4 hover:text-papel"
          >
            {t("lista.buscar")}
          </Link>
        </nav>
      </header>

      {error ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {error}
        </p>
      ) : null}

      {amigos.isPending ? (
        <div role="status" aria-label={t("lista.cargando")} className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : amigos.isError ? (
        <EstadoError mensaje={t("lista.error")} onReintentar={() => void amigos.refetch()} />
      ) : amigos.data.items.length === 0 ? (
        <EstadoVacio
          titulo={t("lista.vacioTitulo")}
          texto={t("lista.vacioTexto")}
          accion={
            <Link
              href="/amigos/buscar"
              className="inline-block rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
            >
              {t("lista.buscar")}
            </Link>
          }
        />
      ) : (
        <>
          <ul
            className="space-y-3"
            aria-busy={amigos.isFetching || undefined}
            aria-label={t("lista.titulo")}
          >
            {amigos.data.items.map(({ amistadId, usuario }) => (
              <li
                key={amistadId}
                className="flex items-center gap-3 rounded-sm border border-papel/10 bg-butaca p-4"
              >
                <Avatar nombre={usuario.nombre} url={usuario.avatarUrl} tamano={44} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/usuarios/${usuario.id}`}
                    className="block truncate font-medium hover:text-luz"
                  >
                    {usuario.nombre}
                  </Link>
                  <p className="truncate text-sm text-niebla">@{usuario.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAEliminar({ amistadId, nombre: usuario.nombre })}
                  className="shrink-0 rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-brasa hover:text-brasa"
                >
                  {t("lista.eliminar")}
                </button>
              </li>
            ))}
          </ul>
          <PaginacionBotones
            pagina={pagina}
            total={amigos.data.total}
            tamano={TAMANO_PAGINA}
            onCambio={setPagina}
          />
        </>
      )}

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo={t("lista.eliminarTitulo", { nombre: aEliminar?.nombre ?? "" })}
        texto={t("lista.eliminarTexto")}
        textoConfirmar={accion.isPending ? t("lista.eliminando") : t("lista.eliminarConfirmar")}
        textoCancelar={t("lista.eliminarCancelar")}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setAEliminar(null)}
      />
    </section>
  );
}
