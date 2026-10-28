"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { camposDeError, mensajeDeError } from "@/shared/api";
import { requisitosContrasena } from "@/features/auth/registro-campos";
import { FORMULARIO_CONTRASENA, type FormularioContrasena } from "./perfil-campos";
import { useCambiarContrasena } from "./perfil";

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Cambio de contraseña. La API cierra las demás sesiones al cambiarla.
export function SeccionContrasena() {
  const t = useTranslations("perfil");
  const tRegistro = useTranslations("registro");
  const id = useId();
  const cambiar = useCambiarContrasena();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormularioContrasena>({
    resolver: zodResolver(FORMULARIO_CONTRASENA),
    mode: "onChange",
    defaultValues: { contrasenaActual: "", contrasenaNueva: "", confirmacion: "" },
  });

  const nueva = watch("contrasenaNueva") ?? "";

  const enviar = handleSubmit((datos) => {
    setMensaje(null);
    setErrorGeneral(null);
    cambiar.mutate(
      { contrasenaActual: datos.contrasenaActual, contrasenaNueva: datos.contrasenaNueva },
      {
        onSuccess: () => {
          reset();
          setMensaje(t("contrasena.exito"));
        },
        onError: (error) => {
          const campos = camposDeError(error);
          if (Object.keys(campos).length === 0) {
            setErrorGeneral(mensajeDeError(error));
            return;
          }
          if (campos.contrasenaActual) {
            setError("contrasenaActual", { type: "server", message: campos.contrasenaActual });
          }
          if (campos.contrasenaNueva) {
            setError("contrasenaNueva", { type: "server", message: campos.contrasenaNueva });
          }
        },
      },
    );
  });

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-5">
      <h2 id={`${id}-titulo`} className="font-display text-2xl">
        {t("contrasena.titulo")}
      </h2>

      {errorGeneral ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {errorGeneral}
        </p>
      ) : null}
      {mensaje ? (
        <p role="status" className="text-sm text-musgo">
          {mensaje}
        </p>
      ) : null}

      <form noValidate onSubmit={enviar} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-actual`} className="block text-sm text-niebla">
            {t("contrasena.actual")}
          </label>
          <input
            id={`${id}-actual`}
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.contrasenaActual ? "true" : undefined}
            aria-describedby={errors.contrasenaActual ? `${id}-actual-error` : undefined}
            className={CLASE_INPUT}
            {...register("contrasenaActual")}
          />
          {errors.contrasenaActual ? (
            <p id={`${id}-actual-error`} className="text-sm text-brasa">
              {errors.contrasenaActual.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-nueva`} className="block text-sm text-niebla">
            {t("contrasena.nueva")}
          </label>
          <input
            id={`${id}-nueva`}
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.contrasenaNueva ? "true" : undefined}
            aria-describedby={`${id}-requisitos`}
            className={CLASE_INPUT}
            {...register("contrasenaNueva")}
          />
          <ul id={`${id}-requisitos`} className="space-y-0.5 text-sm">
            {requisitosContrasena(nueva).map((requisito) => (
              <li key={requisito.clave} className={requisito.cumple ? "text-musgo" : "text-niebla"}>
                {requisito.cumple ? "✓ " : "· "}
                {tRegistro(requisito.clave)}
              </li>
            ))}
          </ul>
          {errors.contrasenaNueva ? (
            <p className="text-sm text-brasa">{errors.contrasenaNueva.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-confirmacion`} className="block text-sm text-niebla">
            {t("contrasena.confirmacion")}
          </label>
          <input
            id={`${id}-confirmacion`}
            type="password"
            autoComplete="new-password"
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
          disabled={cambiar.isPending}
          aria-busy={cambiar.isPending || undefined}
          className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cambiar.isPending ? t("contrasena.guardando") : t("contrasena.guardar")}
        </button>
      </form>
    </section>
  );
}
