"use client";

import type { ResenaLista } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useSesion } from "@/features/auth/sesion";
import { comentarioVisible } from "@/features/catalogo/ficha-logica";
import { formatoFecha } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { Insignia } from "@/shared/ui/insignia";
import { ModalConfirmacion } from "@/shared/ui/modal-confirmacion";
import { mensajeDeError } from "@/shared/api";
import { useEliminarResena } from "./resenas";

// Una reseña: calificación y etiquetas antes del comentario. Un spoiler pide confirmación para verlo.
// Si la reseña es del usuario de la sesión, ofrece editarla y eliminarla.
// alEditar: si se pasa, «Editar» llama a esa función (la ficha abre su formulario); si no, lleva a la ficha.
export function ResenaItem({ resena, alEditar }: { resena: ResenaLista; alEditar?: () => void }) {
  const t = useTranslations("resenas");
  const sesion = useSesion();
  const eliminar = useEliminarResena();
  const [revelado, setRevelado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = comentarioVisible(resena.esSpoiler, revelado);
  const esPropia = sesion.data?.id === resena.autor.id;
  const ocultaPropia = esPropia && resena.ocultaPorModeracion === true;

  function confirmarEliminacion() {
    if (eliminar.isPending) return;
    setError(null);
    eliminar.mutate(resena.id, {
      onSuccess: () => setConfirmando(false),
      onError: (err) => {
        setConfirmando(false);
        setError(mensajeDeError(err));
      },
    });
  }

  return (
    <li className="space-y-3 rounded-sm border border-papel/10 bg-butaca p-4 md:p-6">
      {resena.contenido ? (
        <Link href={`/catalogo/${resena.contenido.id}`} className="font-medium hover:text-luz">
          {resena.contenido.titulo}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {resena.autor.eliminado ? (
            <span className="text-niebla">{t("usuarioEliminado")}</span>
          ) : (
            <Link href={`/usuarios/${resena.autor.id}`} className="font-medium hover:text-luz">
              @{resena.autor.username}
            </Link>
          )}
          {resena.visibilidad === "amigos" ? <Insignia texto={t("soloAmigos")} tono="luz" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <time dateTime={resena.fechaCreacion} className="text-xs text-niebla">
            {formatoFecha(resena.fechaCreacion)}
          </time>
          {esPropia ? (
            <div className="flex flex-wrap gap-2 text-sm">
              {alEditar ? (
                <button
                  type="button"
                  onClick={alEditar}
                  className="rounded-sm border border-papel/30 px-3 py-1 hover:border-luz"
                >
                  {t("editar")}
                </button>
              ) : resena.contenido ? (
                <Link
                  href={`/catalogo/${resena.contenido.id}#ficha-formulario-resena`}
                  className="rounded-sm border border-papel/30 px-3 py-1 hover:border-luz"
                >
                  {t("editar")}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="rounded-sm border border-papel/30 px-3 py-1 hover:border-brasa hover:text-brasa"
              >
                {t("eliminar")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Estrellas valor={resena.calificacion} etiqueta={t("calificacion")} />
        {resena.etiquetas.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("etiquetas")}>
            {resena.etiquetas.map((etiqueta) => (
              <li key={etiqueta}>
                <Chip texto={etiqueta} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {ocultaPropia ? (
        <p role="status" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {t("ocultaModeracion")}
        </p>
      ) : null}

      {resena.comentario ? (
        visible ? (
          <p className="whitespace-pre-line text-papel/85">{resena.comentario}</p>
        ) : (
          <div className="space-y-2 rounded-sm border border-brasa/60 p-3">
            <p className="text-sm text-papel/85">{t("spoilerAviso")}</p>
            <button
              type="button"
              onClick={() => setRevelado(true)}
              className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz"
            >
              {t("mostrarSpoiler")}
            </button>
          </div>
        )
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-brasa">
          {error}
        </p>
      ) : null}

      <ModalConfirmacion
        abierto={confirmando}
        titulo={t("eliminarTitulo")}
        texto={t("eliminarTexto")}
        textoConfirmar={eliminar.isPending ? t("eliminando") : t("eliminarConfirmar")}
        textoCancelar={t("cancelar")}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setConfirmando(false)}
      />
    </li>
  );
}
