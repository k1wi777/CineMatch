"use client";

import { ApiError, mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Avatar } from "@/shared/ui/avatar";
import { Estrellas } from "@/shared/ui/estrellas";
import { EstadoError } from "@/shared/ui/estados";
import { Insignia } from "@/shared/ui/insignia";
import { Skeleton } from "@/shared/ui/skeleton";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AccionRelacionUsuario } from "./accion-relacion";
import { usePerfilPublico } from "./usuarios";

// Perfil de otro usuario (FE-2.3). Lo que se ve de reseñas y biblioteca lo decide la API según la relación.
export function PaginaPerfilPublico({ id }: { id: number }) {
  const t = useTranslations("usuarios");
  const perfil = usePerfilPublico(id);
  const router = useRouter();

  const esPropio = perfil.data?.esPropio === true;
  useEffect(() => {
    if (esPropio) router.replace("/perfil");
  }, [esPropio, router]);

  if (perfil.isPending) {
    return (
      <div role="status" aria-label={t("perfil.cargando")} className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (perfil.isError) {
    // 404: la cuenta no existe o está eliminada. No se muestra más detalle.
    if (perfil.error instanceof ApiError && perfil.error.status === 404) {
      return (
        <section className="space-y-4">
          <EstadoError mensaje={t("perfil.noDisponible")} />
          <Link
            href="/amigos/buscar"
            className="block text-center text-sm text-niebla hover:text-papel"
          >
            {t("perfil.volver")}
          </Link>
        </section>
      );
    }
    return (
      <EstadoError
        mensaje={mensajeDeError(perfil.error)}
        onReintentar={() => void perfil.refetch()}
      />
    );
  }

  if (esPropio) return null;

  const { usuario, relacion, amistadId, resenas, biblioteca } = perfil.data;

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar nombre={usuario.nombre} url={usuario.avatarUrl} tamano={80} />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="truncate font-display text-3xl">{usuario.nombre}</h1>
          <p className="text-niebla">@{usuario.username}</p>
          {relacion !== "ninguna" ? (
            <Insignia texto={t(`relacion.${relacion}`)} tono="luz" />
          ) : null}
          {usuario.bio ? <p className="max-w-prose pt-2 text-papel/85">{usuario.bio}</p> : null}
        </div>
        <AccionRelacionUsuario usuarioId={usuario.id} relacion={relacion} amistadId={amistadId} />
      </header>

      <section aria-labelledby="perfil-resenas" className="space-y-5">
        <h2 id="perfil-resenas" className="font-display text-2xl">
          {t("perfil.resenas")}
        </h2>
        {resenas.items.length === 0 ? (
          <p className="text-niebla">{t("perfil.sinResenas")}</p>
        ) : (
          <ul className="space-y-4">
            {resenas.items.map((resena) => (
              <li
                key={resena.id}
                className="space-y-2 rounded-sm border border-papel/10 bg-butaca p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {resena.contenido ? (
                    <Link
                      href={`/catalogo/${resena.contenido.id}`}
                      className="font-medium hover:text-luz"
                    >
                      {resena.contenido.titulo}
                    </Link>
                  ) : null}
                  <Estrellas valor={resena.calificacion} etiqueta={t("perfil.calificacion")} />
                </div>
                {resena.comentario ? <p className="text-papel/85">{resena.comentario}</p> : null}
                <p className="text-xs text-niebla">{formatoFecha(resena.fechaCreacion)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="perfil-biblioteca" className="space-y-5">
        <h2 id="perfil-biblioteca" className="font-display text-2xl">
          {t("perfil.biblioteca")}
        </h2>
        {biblioteca === null ? (
          <p className="text-niebla">{t("perfil.bibliotecaPrivada")}</p>
        ) : biblioteca.items.length === 0 ? (
          <p className="text-niebla">{t("perfil.sinBiblioteca")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {biblioteca.items.map((elemento) => (
              <li
                key={elemento.id}
                className="flex items-center justify-between gap-3 rounded-sm border border-papel/10 p-3"
              >
                <Link href={`/catalogo/${elemento.id}`} className="min-w-0 truncate hover:text-luz">
                  {elemento.titulo}
                </Link>
                <Insignia texto={t(`perfil.estado.${elemento.estado}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
