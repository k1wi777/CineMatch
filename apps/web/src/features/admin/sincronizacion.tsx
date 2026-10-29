"use client";

import { useTranslations } from "next-intl";
import { mensajeDeError } from "@/shared/api";
import { formatoFecha, formatoNumero } from "@/shared/formato";
import { EstadoError } from "@/shared/ui/estados";
import { Insignia, type TonoInsignia } from "@/shared/ui/insignia";
import { Skeleton } from "@/shared/ui/skeleton";
import { puedeSincronizar } from "./logica";
import { useEstadoSincronizacion, useIniciarSincronizacion } from "./admin";

const TONO: Record<string, TonoInsignia> = {
  inactiva: "neutro",
  en_curso: "luz",
  ok: "exito",
  error: "error",
};

// Sincronización del catálogo con la fuente externa (FE-10.1). Corre en segundo plano y se consulta su estado.
export function PanelSincronizacion() {
  const t = useTranslations("admin.sincronizacion");
  const estado = useEstadoSincronizacion();
  const iniciar = useIniciarSincronizacion();
  const puede = puedeSincronizar(estado.data, iniciar.isPending);

  if (estado.isPending) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (estado.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(estado.error)}
        onReintentar={() => void estado.refetch()}
      />
    );
  }
  const actual = estado.data;

  return (
    <section aria-labelledby="admin-sync" className="space-y-6">
      <header className="space-y-2">
        <h2 id="admin-sync" className="font-display text-2xl">
          {t("titulo")}
        </h2>
        <p className="max-w-prose text-sm text-papel/70">{t("ayuda")}</p>
      </header>

      <div className="space-y-5 rounded-sm border border-papel/10 bg-butaca p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-niebla">{t("estado")}</span>
          <Insignia texto={t(`estados.${actual.estado}`)} tono={TONO[actual.estado] ?? "neutro"} />
          {actual.terminadaEn ? (
            <span className="text-xs text-niebla">
              {t("terminada", {
                fecha: formatoFecha(actual.terminadaEn, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </span>
          ) : null}
        </div>

        {actual.ultimoResumen ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ["agregados", actual.ultimoResumen.agregados],
                ["actualizados", actual.ultimoResumen.actualizados],
                ["descartados", actual.ultimoResumen.descartados],
                ["generos", actual.ultimoResumen.generosAgregados],
              ] as const
            ).map(([clave, valor]) => (
              <div key={clave}>
                <dt className="text-xs text-niebla">{t(`resumen.${clave}`)}</dt>
                <dd className="font-display text-2xl">{formatoNumero(valor)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {actual.estado === "error" && actual.error ? (
          <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
            {t("errorFuente", { detalle: actual.error })}
          </p>
        ) : null}

        {iniciar.isError ? (
          <p role="alert" className="text-sm text-brasa">
            {mensajeDeError(iniciar.error)}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => iniciar.mutate()}
          disabled={!puede}
          aria-busy={actual.estado === "en_curso" || iniciar.isPending || undefined}
          className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actual.estado === "en_curso" || iniciar.isPending ? t("enCurso") : t("sincronizar")}
        </button>
      </div>
    </section>
  );
}
