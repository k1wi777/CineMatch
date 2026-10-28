"use client";

import type { Perfil } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type ChangeEvent } from "react";
import { mensajeDeError } from "@/shared/api";
import { Avatar } from "@/shared/ui/avatar";
import { errorArchivoAvatar, TIPOS_AVATAR } from "./archivo-avatar";
import { useQuitarAvatar, useSubirAvatar } from "./perfil";

// Foto de perfil: elegir, ver vista previa, subir con progreso y quitar.
// La validación de tipo y tamaño se hace antes de subir; la API la repite.
export function SeccionAvatar({ perfil }: { perfil: Perfil }) {
  const t = useTranslations("perfil");
  const id = useId();
  const subir = useSubirAvatar();
  const quitar = useQuitarAvatar();

  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // La vista previa usa una URL temporal que se libera al cambiar de archivo o al salir.
  useEffect(() => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const ocupado = subir.isPending || quitar.isPending;

  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0] ?? null;
    setMensaje(null);
    setError(null);
    if (!elegido) {
      setArchivo(null);
      return;
    }
    const problema = errorArchivoAvatar(elegido);
    if (problema) {
      setError(problema === "tipo" ? t("avatar.errorTipo") : t("avatar.errorTamano"));
      setArchivo(null);
      return;
    }
    setArchivo(elegido);
  }

  function enviar() {
    if (!archivo) return;
    setMensaje(null);
    setError(null);
    setProgreso(0);
    subir.mutate(
      { archivo, onProgreso: setProgreso },
      {
        onSuccess: () => {
          setArchivo(null);
          setProgreso(null);
          setMensaje(t("avatar.exito"));
        },
        onError: (err) => {
          setProgreso(null);
          setError(mensajeDeError(err));
        },
      },
    );
  }

  function quitarFoto() {
    setMensaje(null);
    setError(null);
    quitar.mutate(undefined, {
      onSuccess: () => {
        setArchivo(null);
        setMensaje(t("avatar.quitada"));
      },
      onError: (err) => setError(mensajeDeError(err)),
    });
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-5">
      <h2 id={`${id}-titulo`} className="font-display text-2xl">
        {t("avatar.titulo")}
      </h2>

      <div className="flex items-center gap-5">
        <Avatar nombre={perfil.nombre} url={vista ?? perfil.avatarUrl} tamano={96} />
        <div className="space-y-2">
          <label
            htmlFor={`${id}-archivo`}
            className="inline-block cursor-pointer rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
          >
            {t("avatar.elegir")}
          </label>
          <input
            id={`${id}-archivo`}
            type="file"
            accept={TIPOS_AVATAR.join(",")}
            disabled={ocupado}
            onChange={alElegir}
            className="sr-only"
          />
          <p className="text-xs text-niebla">{t("avatar.ayuda")}</p>
        </div>
      </div>

      {progreso !== null ? (
        <div
          role="progressbar"
          aria-label={t("avatar.progreso")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progreso}
          className="h-1 w-full overflow-hidden rounded-full bg-papel/10"
        >
          <div className="h-1 bg-luz transition-[width]" style={{ width: `${progreso}%` }} />
        </div>
      ) : null}

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

      <div className="flex flex-wrap gap-3">
        {archivo ? (
          <button
            type="button"
            onClick={enviar}
            disabled={ocupado}
            aria-busy={subir.isPending || undefined}
            className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala disabled:opacity-50"
          >
            {subir.isPending ? t("avatar.subiendo") : t("avatar.subir")}
          </button>
        ) : null}
        {perfil.avatarUrl && !archivo ? (
          <button
            type="button"
            onClick={quitarFoto}
            disabled={ocupado}
            className="rounded-sm border border-papel/30 px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("avatar.quitar")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
