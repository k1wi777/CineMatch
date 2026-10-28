"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { camposDeError, mensajeDeError, peticion } from "@/shared/api";
import { ModalConfirmacion } from "@/shared/ui/modal-confirmacion";
import { FORMULARIO_ELIMINAR, TEXTO_CONFIRMACION, type FormularioEliminar } from "./cuenta-campos";

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Mis datos (FE-2.4): derechos, exportación en JSON y eliminación de la cuenta.
// La eliminación pide contraseña, escribir ELIMINAR y una confirmación final en un modal.
export function PaginaMisDatos() {
  const t = useTranslations("datos");
  const id = useId();
  const router = useRouter();
  const cliente = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormularioEliminar>({
    resolver: zodResolver(FORMULARIO_ELIMINAR),
    mode: "onChange",
    defaultValues: { contrasena: "", confirmacion: "" },
  });

  const eliminar = useMutation({
    mutationFn: (datos: { password: string }) =>
      peticion<void>("/api/users/me", {
        metodo: "DELETE",
        cuerpo: { password: datos.password, confirmacion: TEXTO_CONFIRMACION },
      }),
    onSuccess: () => {
      cliente.clear();
      router.replace("/login?aviso=cuenta-eliminada");
    },
    onError: (error) => {
      setModalAbierto(false);
      const campos = camposDeError(error);
      if (campos.password) {
        setError("contrasena", { type: "server", message: campos.password });
        return;
      }
      if (campos.confirmacion) {
        setError("confirmacion", { type: "server", message: campos.confirmacion });
        return;
      }
      setErrorGeneral(mensajeDeError(error));
    },
  });

  // Pasar la validación del formulario abre la confirmación final; no elimina por sí solo.
  const pedirConfirmacion = handleSubmit(() => {
    setErrorGeneral(null);
    setModalAbierto(true);
  });

  function confirmarEliminacion() {
    if (eliminar.isPending) return;
    eliminar.mutate({ password: getValues("contrasena") });
  }

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        <p className="text-niebla">{t("ayuda")}</p>
      </header>

      <section aria-labelledby={`${id}-derechos`} className="space-y-4">
        <h2 id={`${id}-derechos`} className="font-display text-2xl">
          {t("derechos.titulo")}
        </h2>
        <p className="max-w-prose text-papel/85">{t("derechos.texto")}</p>
      </section>

      <section aria-labelledby={`${id}-exportar`} className="space-y-4">
        <h2 id={`${id}-exportar`} className="font-display text-2xl">
          {t("exportar.titulo")}
        </h2>
        <p className="max-w-prose text-papel/85">{t("exportar.texto")}</p>
        <a
          href="/api/users/me/data-export"
          download
          className="inline-block rounded-sm border border-papel/30 px-4 py-2 text-sm hover:border-luz"
        >
          {t("exportar.boton")}
        </a>
      </section>

      <section aria-labelledby={`${id}-eliminar`} className="space-y-5">
        <h2 id={`${id}-eliminar`} className="font-display text-2xl">
          {t("eliminar.titulo")}
        </h2>

        <div className="max-w-prose space-y-3 text-sm">
          <p className="text-papel/85">{t("eliminar.seElimina")}</p>
          <p className="text-papel/85">{t("eliminar.seConserva")}</p>
          <p role="note" className="rounded-sm border border-brasa px-3 py-2 text-brasa">
            {t("eliminar.advertencia")}
          </p>
        </div>

        {errorGeneral ? (
          <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
            {errorGeneral}
          </p>
        ) : null}

        <form noValidate onSubmit={pedirConfirmacion} className="max-w-md space-y-5">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-contrasena`} className="block text-sm text-niebla">
              {t("eliminar.contrasena")}
            </label>
            <input
              id={`${id}-contrasena`}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.contrasena ? "true" : undefined}
              aria-describedby={errors.contrasena ? `${id}-contrasena-error` : undefined}
              className={CLASE_INPUT}
              {...register("contrasena")}
            />
            {errors.contrasena ? (
              <p id={`${id}-contrasena-error`} className="text-sm text-brasa">
                {errors.contrasena.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${id}-confirmacion`} className="block text-sm text-niebla">
              {t("eliminar.confirmacion", { texto: TEXTO_CONFIRMACION })}
            </label>
            <input
              id={`${id}-confirmacion`}
              autoComplete="off"
              aria-invalid={errors.confirmacion ? "true" : undefined}
              aria-describedby={errors.confirmacion ? `${id}-confirmacion-error` : undefined}
              className={CLASE_INPUT}
              {...register("confirmacion")}
            />
            {errors.confirmacion ? (
              <p id={`${id}-confirmacion-error`} className="text-sm text-brasa">
                {errors.confirmacion.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="rounded-sm border border-brasa px-4 py-2 text-sm font-semibold text-brasa hover:bg-brasa hover:text-sala"
          >
            {t("eliminar.boton")}
          </button>
        </form>
      </section>

      <ModalConfirmacion
        abierto={modalAbierto}
        titulo={t("modal.titulo")}
        texto={t("modal.texto")}
        textoConfirmar={eliminar.isPending ? t("modal.eliminando") : t("modal.confirmar")}
        textoCancelar={t("modal.cancelar")}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setModalAbierto(false)}
      />
    </div>
  );
}
