"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRecibidasRecientes } from "@/features/recomendaciones/bandeja";
import { mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { EstadoError } from "@/shared/ui/estados";
import { SkeletonCartel } from "@/shared/ui/skeleton";
import { TarjetaTitulo } from "@/shared/ui/tarjeta-titulo";
import { useRecomendacionesComunidad } from "./comunidad";
import { HeroInicio } from "./hero-inicio";
import { TarjetaComunidad } from "./tarjeta-comunidad";

const MAX_RECIBIDAS = 6;
const MAX_COMUNIDAD = 12;

// Página de inicio (FE-9.2): recibidas recientes (si hay) y recomendaciones de la comunidad.
// Cada sección tiene su propio estado de carga, vacío y error.
export function PaginaInicio() {
  return (
    <div className="space-y-12">
      <HeroInicio />
      <SeccionRecibidas />
      <SeccionComunidad />
    </div>
  );
}

function SeccionRecibidas() {
  const t = useTranslations("inicio");
  const recibidas = useRecibidasRecientes(MAX_RECIBIDAS);

  if (recibidas.isPending) {
    return (
      <div role="status" aria-label={t("cargando")}>
        <SkeletonCartel />
      </div>
    );
  }
  if (recibidas.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(recibidas.error)}
        onReintentar={() => void recibidas.refetch()}
      />
    );
  }
  // Sin recomendaciones recibidas, la sección no aparece.
  if (recibidas.data.items.length === 0) return null;

  return (
    <section aria-labelledby="inicio-recibidas" className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 id="inicio-recibidas" className="font-display text-2xl">
          {t("recibidas.titulo")}
        </h2>
        <Link
          href="/recomendaciones"
          className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("verTodas")}
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-6">
        {recibidas.data.items.map((item) => (
          <li key={item.id} className="space-y-1">
            <TarjetaTitulo
              id={item.contenido.id}
              titulo={item.contenido.titulo}
              posterUrl={item.contenido.posterUrl}
            />
            <p className="text-xs text-niebla">
              {t("recibidas.de", { usuario: item.emisor.username })} ·{" "}
              {formatoFecha(item.fechaEnvio)}
            </p>
            <Link href={`/recomendaciones/${item.id}`} className="text-xs text-luz hover:underline">
              {t("recibidas.ver")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeccionComunidad() {
  const t = useTranslations("inicio");
  const comunidad = useRecomendacionesComunidad({ page: 1, pageSize: MAX_COMUNIDAD });

  return (
    <section aria-labelledby="inicio-comunidad" className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 id="inicio-comunidad" className="font-display text-2xl">
          {t("comunidad.titulo")}
        </h2>
        <Link
          href="/comunidad"
          className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("verTodas")}
        </Link>
      </div>

      {comunidad.isPending ? (
        <div
          role="status"
          aria-label={t("cargando")}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, indice) => (
            <SkeletonCartel key={indice} />
          ))}
        </div>
      ) : comunidad.isError ? (
        <EstadoError
          mensaje={mensajeDeError(comunidad.error)}
          onReintentar={() => void comunidad.refetch()}
        />
      ) : comunidad.data.items.length === 0 ? (
        <p className="text-niebla">{t("comunidad.vacio")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6">
          {comunidad.data.items.map((titulo) => (
            <li key={titulo.id}>
              <TarjetaComunidad titulo={titulo} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
