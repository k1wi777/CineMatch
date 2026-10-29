"use client";

import type { ModeracionQuery, ResenaModeracion } from "@cinematch/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useValorDiferido } from "@/features/usuarios/usuarios";
import { mensajeDeError } from "@/shared/api";
import { formatoFecha } from "@/shared/formato";
import { Chip } from "@/shared/ui/chip";
import { Estrellas } from "@/shared/ui/estrellas";
import { EstadoError, EstadoVacio } from "@/shared/ui/estados";
import { Insignia } from "@/shared/ui/insignia";
import { ModalConfirmacion } from "@/shared/ui/modal-confirmacion";
import { PaginacionBotones } from "@/shared/ui/paginacion-botones";
import { Skeleton } from "@/shared/ui/skeleton";
import { accionModeracion } from "./logica";
import { useModeracion, useModerarResena } from "./admin";

const TAMANO_PAGINA = 20;
const CLASE_CAMPO =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm focus:border-luz focus:outline-none";

// Moderación de reseñas (FE-10.2): filtros, detalle completo y ocultar o restablecer con confirmación.
export function PanelModeracion() {
  const t = useTranslations("admin.moderacion");
  const idBase = useId();
  const [estado, setEstado] = useState<"visible" | "oculta" | "">("");
  const [contentId, setContentId] = useState("");
  const [autorTexto, setAutorTexto] = useState("");
  const [textoLibre, setTextoLibre] = useState("");
  const [pagina, setPagina] = useState(1);
  const autor = useValorDiferido(autorTexto.trim(), 300);
  const q = useValorDiferido(textoLibre.trim(), 300);
  const [aConfirmar, setAConfirmar] = useState<ResenaModeracion | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtros: ModeracionQuery = {
    estado: estado === "" ? undefined : estado,
    contentId: contentId ? Number(contentId) : undefined,
    autor: autor || undefined,
    q: q || undefined,
    page: pagina,
    pageSize: TAMANO_PAGINA,
  };
  const lista = useModeracion(filtros);
  const moderar = useModerarResena();

  function cambiarFiltro(cambio: () => void) {
    cambio();
    setPagina(1);
  }

  function confirmar() {
    if (!aConfirmar || moderar.isPending) return;
    setError(null);
    moderar.mutate(
      { id: aConfirmar.id, accion: accionModeracion(aConfirmar.visible) },
      {
        onSuccess: () => setAConfirmar(null),
        onError: (err) => {
          setAConfirmar(null);
          setError(mensajeDeError(err));
        },
      },
    );
  }

  const accion = aConfirmar ? accionModeracion(aConfirmar.visible) : null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-2xl">{t("titulo")}</h2>
        <p className="max-w-prose text-sm text-papel/70">{t("ayuda")}</p>
      </header>

      <form
        role="search"
        noValidate
        onSubmit={(evento) => evento.preventDefault()}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-estado`} className="block text-xs text-niebla">
            {t("filtros.estado")}
          </label>
          <select
            id={`${idBase}-estado`}
            value={estado}
            onChange={(evento) =>
              cambiarFiltro(() => setEstado(evento.target.value as typeof estado))
            }
            className={CLASE_CAMPO}
          >
            <option value="">{t("filtros.todas")}</option>
            <option value="visible">{t("filtros.visibles")}</option>
            <option value="oculta">{t("filtros.ocultas")}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-titulo`} className="block text-xs text-niebla">
            {t("filtros.titulo")}
          </label>
          <input
            id={`${idBase}-titulo`}
            inputMode="numeric"
            placeholder={t("filtros.idTitulo")}
            value={contentId}
            onChange={(evento) =>
              cambiarFiltro(() => setContentId(evento.target.value.replace(/\D/g, "")))
            }
            className={CLASE_CAMPO}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-autor`} className="block text-xs text-niebla">
            {t("filtros.autor")}
          </label>
          <input
            id={`${idBase}-autor`}
            value={autorTexto}
            onChange={(evento) => cambiarFiltro(() => setAutorTexto(evento.target.value))}
            className={CLASE_CAMPO}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-texto`} className="block text-xs text-niebla">
            {t("filtros.texto")}
          </label>
          <input
            id={`${idBase}-texto`}
            value={textoLibre}
            onChange={(evento) => cambiarFiltro(() => setTextoLibre(evento.target.value))}
            className={CLASE_CAMPO}
          />
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {error}
        </p>
      ) : null}

      {lista.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : lista.isError ? (
        <EstadoError
          mensaje={mensajeDeError(lista.error)}
          onReintentar={() => void lista.refetch()}
        />
      ) : lista.data.items.length === 0 ? (
        <EstadoVacio titulo={t("vacioTitulo")} texto={t("vacioTexto")} />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={lista.isFetching || undefined}>
            {lista.data.items.map((resena) => {
              const expandida = abierta === resena.id;
              return (
                <li
                  key={resena.id}
                  className="space-y-3 rounded-sm border border-papel/10 bg-butaca p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{resena.contenido.titulo}</span>
                    <span className="text-niebla">
                      @{resena.autor.username} · {formatoFecha(resena.fechaCreacion)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Estrellas valor={resena.calificacion} etiqueta={t("calificacion")} />
                    <Insignia
                      texto={t(resena.visible ? "visible" : "oculta")}
                      tono={resena.visible ? "exito" : "error"}
                    />
                    <Insignia
                      texto={t(resena.visibilidad === "amigos" ? "soloAmigos" : "publica")}
                      tono="neutro"
                    />
                    {resena.esSpoiler ? <Insignia texto={t("spoiler")} tono="luz" /> : null}
                  </div>
                  {resena.etiquetas.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {resena.etiquetas.map((etiqueta) => (
                        <li key={etiqueta}>
                          <Chip texto={etiqueta} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {expandida ? (
                    <div className="space-y-2 rounded-sm border border-papel/10 p-3 text-sm">
                      <p className="whitespace-pre-line text-papel/85">
                        {resena.comentario ?? t("sinComentario")}
                      </p>
                      <p className="text-xs text-niebla">
                        {t("detalle", {
                          id: resena.id,
                          autor: resena.autor.id,
                          titulo: resena.contenido.id,
                        })}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-expanded={expandida}
                      onClick={() => setAbierta(expandida ? null : resena.id)}
                      className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-luz"
                    >
                      {expandida ? t("cerrarDetalle") : t("verDetalle")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAConfirmar(resena)}
                      disabled={moderar.isPending}
                      className="rounded-sm border border-papel/30 px-3 py-1.5 text-sm hover:border-brasa disabled:opacity-50"
                    >
                      {t(resena.visible ? "ocultar" : "restablecer")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <PaginacionBotones
            pagina={pagina}
            total={lista.data.total}
            tamano={TAMANO_PAGINA}
            onCambio={setPagina}
          />
        </>
      )}

      <ModalConfirmacion
        abierto={aConfirmar !== null}
        titulo={t(accion === "ocultar" ? "confirmar.ocultarTitulo" : "confirmar.restablecerTitulo")}
        texto={t(accion === "ocultar" ? "confirmar.ocultarTexto" : "confirmar.restablecerTexto")}
        textoConfirmar={
          moderar.isPending
            ? t("confirmar.enviando")
            : t(accion === "ocultar" ? "ocultar" : "restablecer")
        }
        textoCancelar={t("confirmar.cancelar")}
        onConfirmar={confirmar}
        onCancelar={() => setAConfirmar(null)}
      />
    </section>
  );
}
