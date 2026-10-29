"use client";

import {
  EscribirResenaSchema,
  MAX_COMENTARIO,
  MAX_ETIQUETAS_RESENA,
  MAX_LONGITUD_ETIQUETA,
  type EscribirResena,
  type ResenaLista,
  type VisibilidadResena,
} from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, camposDeError, mensajeDeError } from "@/shared/api";
import { formatoNumero } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { agregarEtiqueta, sugerirEtiquetas, type ErrorEtiqueta } from "./etiquetas";
import { useGuardarResena } from "./resenas";

const CLASE_CAMPO =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

type Errores = Partial<Record<keyof EscribirResena | "general", string>>;

// Escribir o editar la reseña del usuario en un título (FE-5.1). Si ya existe, se edita (PUT).
export function FormularioResena({
  contenidoId,
  existente,
}: {
  contenidoId: number;
  existente: ResenaLista | null;
}) {
  const t = useTranslations("resenas");
  const id = useId();
  const guardar = useGuardarResena(contenidoId);

  const [calificacion, setCalificacion] = useState<number | null>(existente?.calificacion ?? null);
  const [comentario, setComentario] = useState(existente?.comentario ?? "");
  const [visibilidad, setVisibilidad] = useState<VisibilidadResena>(
    existente?.visibilidad ?? "publica",
  );
  const [esSpoiler, setEsSpoiler] = useState(existente?.esSpoiler ?? false);
  const [etiquetas, setEtiquetas] = useState<string[]>(existente?.etiquetas ?? []);
  const [etiquetaTexto, setEtiquetaTexto] = useState("");
  const [errorEtiqueta, setErrorEtiqueta] = useState<ErrorEtiqueta | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [guardada, setGuardada] = useState(false);

  const hayComentario = comentario.trim().length > 0;
  const sugerencias = hayComentario ? sugerirEtiquetas(comentario, etiquetas) : [];

  function anadirEtiqueta(texto: string) {
    const resultado = agregarEtiqueta(etiquetas, texto);
    setErrorEtiqueta(resultado.error ?? null);
    if (!resultado.error) {
      setEtiquetas(resultado.etiquetas);
      setEtiquetaTexto("");
    }
  }

  function alPulsarEtiqueta(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter" || evento.key === ",") {
      evento.preventDefault();
      anadirEtiqueta(etiquetaTexto);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardada(false);
    const nuevosErrores: Errores = {};
    if (calificacion === null) {
      nuevosErrores.calificacion = t("formulario.calificacionRequerida");
    }
    const cuerpo: EscribirResena = {
      calificacion: calificacion ?? 0,
      comentario: hayComentario ? comentario.trim() : null,
      visibilidad,
      esSpoiler,
      etiquetas: hayComentario ? etiquetas : [],
    };
    // Mismas reglas que la API: se valida antes de enviar y se muestran los errores junto al campo.
    const validacion = EscribirResenaSchema.safeParse(cuerpo);
    if (!validacion.success) {
      for (const problema of validacion.error.issues) {
        const campo = problema.path[0];
        if (typeof campo === "string" && nuevosErrores[campo as keyof Errores] === undefined) {
          nuevosErrores[campo as keyof Errores] = problema.message;
        }
      }
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});
    guardar.mutate(cuerpo, {
      onSuccess: () => setGuardada(true),
      onError: (err) => {
        const campos = err instanceof ApiError ? camposDeError(err) : {};
        if (Object.keys(campos).length > 0) {
          setErrores(campos as Errores);
        } else {
          setErrores({ general: mensajeDeError(err) });
        }
      },
    });
  }

  const visibilidades: { valor: VisibilidadResena; texto: string; ayuda: string }[] = [
    {
      valor: "publica",
      texto: t("formulario.visibilidadPublica"),
      ayuda: t("formulario.visibilidadPublicaAyuda"),
    },
    {
      valor: "amigos",
      texto: t("formulario.visibilidadAmigos"),
      ayuda: t("formulario.visibilidadAmigosAyuda"),
    },
  ];

  return (
    <form noValidate onSubmit={enviar} className="space-y-6" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="font-display text-xl">
        {existente ? t("formulario.editarTitulo") : t("formulario.nuevaTitulo")}
      </h3>

      {errores.general ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {errores.general}
        </p>
      ) : null}
      {guardada ? (
        <p role="status" className="text-sm text-musgo">
          {t("formulario.guardada")}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm text-niebla">{t("formulario.calificacion")}</p>
        <Estrellas
          valor={calificacion ?? 0}
          onCambio={(nueva) => {
            setCalificacion(nueva);
            setErrores((actuales) => ({ ...actuales, calificacion: undefined }));
          }}
          etiqueta={t("formulario.calificacion")}
        />
        {errores.calificacion ? <p className="text-sm text-brasa">{errores.calificacion}</p> : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-comentario`} className="block text-sm text-niebla">
          {t("formulario.comentario")}
        </label>
        <textarea
          id={`${id}-comentario`}
          rows={4}
          maxLength={MAX_COMENTARIO}
          value={comentario}
          onChange={(evento) => setComentario(evento.target.value)}
          aria-invalid={errores.comentario ? "true" : undefined}
          aria-describedby={`${id}-comentario-contador`}
          className={CLASE_CAMPO}
        />
        <p id={`${id}-comentario-contador`} className="text-xs text-niebla">
          {t("formulario.contador", {
            actual: formatoNumero(comentario.length),
            maximo: formatoNumero(MAX_COMENTARIO),
          })}
        </p>
        {errores.comentario ? <p className="text-sm text-brasa">{errores.comentario}</p> : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm text-niebla">{t("formulario.visibilidad")}</legend>
        {visibilidades.map((opcion) => (
          <label key={opcion.valor} className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name={`${id}-visibilidad`}
              value={opcion.valor}
              checked={visibilidad === opcion.valor}
              onChange={() => setVisibilidad(opcion.valor)}
              className="mt-1 accent-luz"
            />
            <span>
              <span className="block text-papel">{opcion.texto}</span>
              <span className="block text-xs text-niebla">{opcion.ayuda}</span>
            </span>
          </label>
        ))}
        {errores.visibilidad ? <p className="text-sm text-brasa">{errores.visibilidad}</p> : null}
      </fieldset>

      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={esSpoiler}
          onChange={(evento) => setEsSpoiler(evento.target.checked)}
          className="h-4 w-4 accent-luz"
        />
        {t("formulario.spoiler")}
      </label>

      <div className="space-y-2">
        <label htmlFor={`${id}-etiqueta`} className="block text-sm text-niebla">
          {t("formulario.etiquetas")}
        </label>
        <input
          id={`${id}-etiqueta`}
          type="text"
          value={etiquetaTexto}
          disabled={!hayComentario}
          onChange={(evento) => {
            setEtiquetaTexto(evento.target.value);
            setErrorEtiqueta(null);
          }}
          onKeyDown={alPulsarEtiqueta}
          onBlur={() => {
            if (etiquetaTexto) anadirEtiqueta(etiquetaTexto);
          }}
          placeholder={
            hayComentario ? t("formulario.etiquetasAyuda") : t("formulario.etiquetasSinComentario")
          }
          aria-describedby={`${id}-etiquetas-ayuda`}
          className={`${CLASE_CAMPO} disabled:opacity-50`}
        />
        <p id={`${id}-etiquetas-ayuda`} className="text-xs text-niebla">
          {t("formulario.etiquetasLimite", {
            maximo: MAX_ETIQUETAS_RESENA,
            largo: MAX_LONGITUD_ETIQUETA,
          })}
        </p>
        {errorEtiqueta ? (
          <p role="alert" className="text-sm text-brasa">
            {t(`formulario.errorEtiqueta.${errorEtiqueta}`)}
          </p>
        ) : null}
        {errores.etiquetas ? <p className="text-sm text-brasa">{errores.etiquetas}</p> : null}

        {etiquetas.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("formulario.etiquetasElegidas")}>
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta}>
                <Chip
                  texto={etiqueta}
                  onQuitar={() => setEtiquetas(etiquetas.filter((valor) => valor !== etiqueta))}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {sugerencias.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-niebla">{t("formulario.sugerencias")}</span>
            {sugerencias.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => anadirEtiqueta(sugerencia)}
                className="rounded-sm border border-papel/20 px-2 py-0.5 text-xs hover:border-luz"
              >
                + {sugerencia}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={guardar.isPending}
        aria-busy={guardar.isPending || undefined}
        className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardar.isPending
          ? t("formulario.guardando")
          : existente
            ? t("formulario.guardarCambios")
            : t("formulario.publicar")}
      </button>
    </form>
  );
}
