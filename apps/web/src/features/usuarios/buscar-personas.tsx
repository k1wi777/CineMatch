"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { Avatar } from "@/shared/ui/avatar";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { AccionRelacionUsuario } from "./accion-relacion";
import { useBusquedaUsuarios, useValorDiferido } from "./usuarios";

// Búsqueda de personas por nombre de usuario (FE-2.2). Espera 300 ms tras la última tecla.
export function BuscarPersonas() {
  const t = useTranslations("usuarios");
  const id = useId();
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useValorDiferido(texto.trim(), 300);
  const busqueda = useBusquedaUsuarios(q, pagina);

  const total = busqueda.data?.total ?? 0;
  const tamano = busqueda.data?.pageSize ?? 20;
  const ultima = Math.max(1, Math.ceil(total / tamano));

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl">{t("buscar.titulo")}</h1>
        <p className="text-niebla">{t("buscar.ayuda")}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-q`} className="block text-sm text-niebla">
          {t("buscar.campo")}
        </label>
        <input
          id={`${id}-q`}
          type="search"
          autoComplete="off"
          placeholder={t("buscar.placeholder")}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setPagina(1);
          }}
          className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none"
        />
      </div>

      {q.length === 0 ? (
        <p className="text-niebla">{t("buscar.inicial")}</p>
      ) : busqueda.isPending ? (
        <div role="status" aria-label={t("buscar.cargando")} className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : busqueda.isError ? (
        <EstadoError
          mensaje={mensajeDeError(busqueda.error)}
          onReintentar={() => void busqueda.refetch()}
        />
      ) : busqueda.data.items.length === 0 ? (
        <EstadoVacio titulo={t("buscar.vacio")} texto={t("buscar.vacioTexto")} />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={busqueda.isFetching || undefined}>
            {busqueda.data.items.map((usuario) => (
              <li
                key={usuario.id}
                className="flex flex-col gap-3 rounded-sm border border-papel/10 bg-butaca p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar nombre={usuario.nombre} url={usuario.avatarUrl} tamano={44} />
                  <div className="min-w-0">
                    <Link
                      href={`/usuarios/${usuario.id}`}
                      className="block truncate font-medium hover:text-luz"
                    >
                      {usuario.nombre}
                    </Link>
                    <p className="truncate text-sm text-niebla">@{usuario.username}</p>
                    {usuario.relacion !== "ninguna" ? (
                      <p className="text-xs text-papel/70">{t(`relacion.${usuario.relacion}`)}</p>
                    ) : null}
                  </div>
                </div>
                <AccionRelacionUsuario
                  usuarioId={usuario.id}
                  relacion={usuario.relacion}
                  amistadId={usuario.amistadId}
                  verPerfil
                />
              </li>
            ))}
          </ul>

          {ultima > 1 ? (
            <nav
              aria-label={t("buscar.paginacion")}
              className="flex items-center justify-center gap-4 text-sm"
            >
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={pagina <= 1}
                className="text-niebla hover:text-papel disabled:opacity-30"
              >
                {t("buscar.anterior")}
              </button>
              <span>{t("buscar.pagina", { actual: pagina, total: ultima })}</span>
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.min(ultima, actual + 1))}
                disabled={pagina >= ultima}
                className="text-niebla hover:text-papel disabled:opacity-30"
              >
                {t("buscar.siguiente")}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
