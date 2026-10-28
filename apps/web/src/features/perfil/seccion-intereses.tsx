"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { mensajeDeError } from "@/shared/api";
import { EstadoError } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { useGeneros } from "@/features/generos/generos";
import { MINIMO_GENEROS } from "@/features/auth/registro-campos";
import { useIntereses, useReemplazarIntereses } from "./perfil";

// Géneros de interés (RN13): mínimo 3. Guardar queda deshabilitado hasta cumplirlo o si no hay cambios.
export function SeccionIntereses() {
  const t = useTranslations("perfil");
  const id = useId();
  const generos = useGeneros();
  const actuales = useIntereses();
  const reemplazar = useReemplazarIntereses();

  const [seleccion, setSeleccion] = useState<number[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const idsActuales = actuales.data?.map((genero) => genero.id) ?? [];
  const ids = seleccion ?? idsActuales;
  const sinCambios =
    ids.length === idsActuales.length && ids.every((valor) => idsActuales.includes(valor));

  function alternar(idGenero: number, marcado: boolean) {
    setMensaje(null);
    setError(null);
    const sinEste = ids.filter((valor) => valor !== idGenero);
    setSeleccion(marcado ? [...sinEste, idGenero] : sinEste);
  }

  function guardar() {
    setMensaje(null);
    setError(null);
    reemplazar.mutate(
      { generoIds: ids },
      {
        onSuccess: () => {
          setSeleccion(null);
          setMensaje(t("intereses.exito"));
        },
        onError: (err) => setError(mensajeDeError(err)),
      },
    );
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-5">
      <div className="space-y-1">
        <h2 id={`${id}-titulo`} className="font-display text-2xl">
          {t("intereses.titulo")}
        </h2>
        <p className="text-sm text-niebla">{t("intereses.ayuda", { minimo: MINIMO_GENEROS })}</p>
      </div>

      {actuales.isPending || generos.isPending ? (
        <div role="status" aria-label={t("intereses.titulo")} className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : actuales.isError || generos.isError ? (
        <EstadoError
          mensaje={t("intereses.error")}
          onReintentar={() => {
            void actuales.refetch();
            void generos.refetch();
          }}
        />
      ) : (
        <fieldset className="space-y-4">
          <legend className="sr-only">{t("intereses.titulo")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(generos.data ?? []).map((genero) => {
              const marcado = ids.includes(genero.id);
              return (
                <label
                  key={genero.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                    marcado ? "border-luz text-papel" : "border-papel/15 text-niebla"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(evento) => alternar(genero.id, evento.target.checked)}
                    className="h-4 w-4 accent-luz"
                  />
                  {genero.nombre}
                </label>
              );
            })}
          </div>

          <p role="status" aria-live="polite" className="text-sm text-papel/85">
            {t("intereses.contador", { elegidos: ids.length, minimo: MINIMO_GENEROS })}
          </p>

          {error ? (
            <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
              {error}
            </p>
          ) : null}
          {mensaje ? (
            <p role="status" className="text-sm text-musgo">
              {mensaje}
            </p>
          ) : null}

          <button
            type="button"
            onClick={guardar}
            disabled={reemplazar.isPending || ids.length < MINIMO_GENEROS || sinCambios}
            aria-busy={reemplazar.isPending || undefined}
            className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reemplazar.isPending ? t("intereses.guardando") : t("intereses.guardar")}
          </button>
        </fieldset>
      )}
    </section>
  );
}
