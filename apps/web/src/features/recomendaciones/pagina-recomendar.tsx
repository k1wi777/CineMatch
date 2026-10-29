"use client";

import type { AmigoRecomendable } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useFicha, useResenasTitulo } from "@/features/catalogo/ficha";
import { ApiError, camposDeError, mensajeDeError } from "@/shared/api";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { agruparAmigos, puedeEnviar } from "./logica";
import { useAmigosRecomendables, useEnviarRecomendacion } from "./recomendaciones";

const MAX_MOTIVO = 500;
const CLASE_CAMPO =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Recomendar un título a un amigo (FE-7.1). Va en su propia página, enlazada desde la ficha.
export function PaginaRecomendar({ id }: { id: number }) {
  const t = useTranslations("recomendar");
  const idBase = useId();
  const ficha = useFicha(id);
  const amigos = useAmigosRecomendables(id);
  const resenas = useResenasTitulo(id, 1);
  const enviar = useEnviarRecomendacion(id);

  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [adjuntar, setAdjuntar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<string | null>(null);

  const miResena =
    resenas.data?.miResena && !resenas.data.miResena.ocultaPorModeracion
      ? resenas.data.miResena
      : null;
  const amigo = amigos.data?.find((candidato) => candidato.id === seleccionado) ?? null;
  const habilitado = puedeEnviar({ amigo, confirmado, enviando: enviar.isPending });

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!amigo || !habilitado) return;
    setError(null);
    setErrorMotivo(null);
    enviar.mutate(
      {
        contentId: id,
        amigoId: amigo.id,
        motivo: motivo.trim() ? motivo.trim() : null,
        resenaId: adjuntar && miResena ? miResena.id : null,
      },
      {
        onSuccess: () => {
          setEnviada(amigo.username);
          setSeleccionado(null);
          setConfirmado(false);
          setMotivo("");
          setAdjuntar(false);
        },
        onError: (err) => {
          const campos = err instanceof ApiError ? camposDeError(err) : {};
          if (campos.motivo) {
            setErrorMotivo(campos.motivo);
          } else {
            setError(mensajeDeError(err));
          }
        },
      },
    );
  }

  if (ficha.isPending || amigos.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (ficha.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(ficha.error)}
        onReintentar={() => void ficha.refetch()}
      />
    );
  }
  if (amigos.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(amigos.error)}
        onReintentar={() => void amigos.refetch()}
      />
    );
  }

  const titulo = ficha.data.titulo;
  const { coinciden, otros } = agruparAmigos(amigos.data);

  function bloque(titulo: string, lista: AmigoRecomendable[]) {
    if (lista.length === 0) return null;
    return (
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-niebla">{titulo}</legend>
        <ul className="space-y-2">
          {lista.map((candidato) => {
            const deshabilitado = !candidato.seleccionable;
            const etiquetas: string[] = [];
            if (candidato.yaLaVio) etiquetas.push(t("etiquetas.yaLaVio"));
            if (candidato.yaRecomendada) etiquetas.push(t("etiquetas.yaRecomendada"));
            if (candidato.fueraDeIntereses) etiquetas.push(t("etiquetas.fuera"));
            return (
              <li key={candidato.id}>
                <label
                  className={`flex items-center gap-3 rounded-sm border px-3 py-2 text-sm ${
                    deshabilitado
                      ? "border-papel/10 text-niebla"
                      : "cursor-pointer border-papel/20 hover:border-luz"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${idBase}-amigo`}
                    value={candidato.id}
                    checked={seleccionado === candidato.id}
                    disabled={deshabilitado}
                    onChange={() => {
                      setSeleccionado(candidato.id);
                      setConfirmado(false);
                    }}
                    className="accent-luz"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">@{candidato.username}</span>
                    <span className="block text-xs text-niebla">
                      {t("generosEnComun", { total: candidato.generosEnComun })}
                      {etiquetas.length > 0 ? ` · ${etiquetas.join(" · ")}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <Link href={`/catalogo/${id}`} className="text-sm text-niebla hover:text-papel">
          {t("volver")}
        </Link>
        <h1 className="font-display text-3xl">{t("titulo", { titulo })}</h1>
      </header>

      {enviada ? (
        <p role="status" className="rounded-sm border border-musgo px-3 py-2 text-sm text-musgo">
          {t("enviada", { usuario: enviada })}
        </p>
      ) : null}

      {amigos.data.length === 0 ? (
        <EstadoVacio
          titulo={t("sinAmigosTitulo")}
          texto={t("sinAmigosTexto")}
          accion={
            <Link
              href="/amigos/buscar"
              className="inline-block rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
            >
              {t("buscarPersonas")}
            </Link>
          }
        />
      ) : (
        <form noValidate onSubmit={alEnviar} className="space-y-8">
          {bloque(t("grupos.coinciden"), coinciden)}
          {bloque(t("grupos.otros"), otros)}

          {amigo?.fueraDeIntereses ? (
            <div className="space-y-2 rounded-sm border border-luz/60 p-4">
              <p className="text-sm text-papel/85">{t("fueraAviso")}</p>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={(evento) => setConfirmado(evento.target.checked)}
                  className="h-6 w-6 accent-luz"
                />
                {t("fueraConfirmar")}
              </label>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor={`${idBase}-motivo`} className="block text-sm text-niebla">
              {t("motivo")}
            </label>
            <textarea
              id={`${idBase}-motivo`}
              rows={3}
              maxLength={MAX_MOTIVO}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={errorMotivo ? "true" : undefined}
              aria-describedby={`${idBase}-motivo-contador`}
              className={CLASE_CAMPO}
            />
            <p id={`${idBase}-motivo-contador`} className="text-xs text-niebla">
              {t("contador", { actual: motivo.length, maximo: MAX_MOTIVO })}
            </p>
            {errorMotivo ? <p className="text-sm text-brasa">{errorMotivo}</p> : null}
          </div>

          {miResena ? (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={adjuntar}
                onChange={(evento) => setAdjuntar(evento.target.checked)}
                className="h-6 w-6 accent-luz"
              />
              {t("adjuntar")}
            </label>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!habilitado}
            aria-busy={enviar.isPending || undefined}
            className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviar.isPending ? t("enviando") : t("enviar")}
          </button>
        </form>
      )}
    </section>
  );
}
