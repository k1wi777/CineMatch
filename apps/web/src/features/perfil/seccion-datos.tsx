"use client";

import type { Perfil } from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { camposDeError, mensajeDeError } from "@/shared/api";
import { BIO_MAXIMA, FORMULARIO_DATOS, type FormularioDatos } from "./perfil-campos";
import { useActualizarPerfil } from "./perfil";

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Nombre, username y biografía. Los errores de username ya usado llegan por campo desde la API.
export function SeccionDatos({ perfil }: { perfil: Perfil }) {
  const t = useTranslations("perfil");
  const id = useId();
  const actualizar = useActualizarPerfil();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormularioDatos>({
    resolver: zodResolver(FORMULARIO_DATOS),
    mode: "onChange",
    defaultValues: { nombre: perfil.nombre, username: perfil.username, bio: perfil.bio ?? "" },
  });

  const bio = watch("bio") ?? "";

  const enviar = handleSubmit((datos) => {
    setMensaje(null);
    setErrorGeneral(null);
    actualizar.mutate(
      {
        nombre: datos.nombre,
        username: datos.username,
        bio: datos.bio.trim() ? datos.bio : null,
      },
      {
        onSuccess: () => {
          setMensaje(t("datos.exito"));
          reset(datos);
        },
        onError: (error) => {
          const campos = camposDeError(error);
          if (Object.keys(campos).length === 0) {
            setErrorGeneral(mensajeDeError(error));
            return;
          }
          for (const [campo, texto] of Object.entries(campos)) {
            if (campo === "nombre" || campo === "username" || campo === "bio") {
              setError(campo, { type: "server", message: texto });
            }
          }
        },
      },
    );
  });

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-5">
      <h2 id={`${id}-titulo`} className="font-display text-2xl">
        {t("datos.titulo")}
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
          <label htmlFor={`${id}-nombre`} className="block text-sm text-niebla">
            {t("datos.nombre")}
          </label>
          <input
            id={`${id}-nombre`}
            autoComplete="name"
            aria-invalid={errors.nombre ? "true" : undefined}
            aria-describedby={errors.nombre ? `${id}-nombre-error` : undefined}
            className={CLASE_INPUT}
            {...register("nombre")}
          />
          {errors.nombre ? (
            <p id={`${id}-nombre-error`} className="text-sm text-brasa">
              {errors.nombre.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-username`} className="block text-sm text-niebla">
            {t("datos.username")}
          </label>
          <input
            id={`${id}-username`}
            autoComplete="username"
            aria-invalid={errors.username ? "true" : undefined}
            aria-describedby={errors.username ? `${id}-username-error` : undefined}
            className={CLASE_INPUT}
            {...register("username")}
          />
          {errors.username ? (
            <p id={`${id}-username-error`} className="text-sm text-brasa">
              {errors.username.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-bio`} className="block text-sm text-niebla">
            {t("datos.bio")}
          </label>
          <textarea
            id={`${id}-bio`}
            rows={4}
            aria-invalid={errors.bio ? "true" : undefined}
            aria-describedby={`${id}-bio-contador${errors.bio ? ` ${id}-bio-error` : ""}`}
            className={CLASE_INPUT}
            {...register("bio")}
          />
          <div className="flex justify-between text-xs text-niebla">
            <span id={`${id}-bio-contador`}>
              {t("datos.contador", { actual: bio.length, maximo: BIO_MAXIMA })}
            </span>
          </div>
          {errors.bio ? (
            <p id={`${id}-bio-error`} className="text-sm text-brasa">
              {errors.bio.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={actualizar.isPending || !isDirty}
          aria-busy={actualizar.isPending || undefined}
          className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actualizar.isPending ? t("datos.guardando") : t("datos.guardar")}
        </button>
      </form>
    </section>
  );
}
