"use client";

import { LoginSchema, type LoginRequest } from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

// Patrón de formulario de la web: React Hook Form + el esquema compartido de packages/shared.
// Los errores aparecen junto al campo, enlazados con aria-describedby, y se anuncian a lectores de pantalla.
export function FormularioEjemplo() {
  const t = useTranslations("ejemplo");
  const id = useId();
  const [exito, setExito] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(LoginSchema) });

  return (
    <section className="mx-auto max-w-sm space-y-6 py-12">
      <h1 className="font-display text-3xl">{t("titulo")}</h1>
      <form
        noValidate
        onSubmit={handleSubmit(() => {
          setExito(true);
        })}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label htmlFor={`${id}-correo`} className="block text-sm text-niebla">
            {t("correo")}
          </label>
          <input
            id={`${id}-correo`}
            type="email"
            autoComplete="email"
            aria-invalid={errors.correo ? "true" : undefined}
            aria-describedby={errors.correo ? `${id}-correo-error` : undefined}
            className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none"
            {...register("correo")}
          />
          {errors.correo ? (
            <p id={`${id}-correo-error`} className="text-sm text-brasa">
              {errors.correo.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-contrasena`} className="block text-sm text-niebla">
            {t("contrasena")}
          </label>
          <input
            id={`${id}-contrasena`}
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.contrasena ? "true" : undefined}
            aria-describedby={errors.contrasena ? `${id}-contrasena-error` : undefined}
            className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none"
            {...register("contrasena")}
          />
          {errors.contrasena ? (
            <p id={`${id}-contrasena-error`} className="text-sm text-brasa">
              {errors.contrasena.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:opacity-60"
        >
          {isSubmitting ? t("enviando") : t("enviar")}
        </button>
        {exito ? (
          <p role="status" className="text-sm text-musgo">
            {t("exito")}
          </p>
        ) : null}
      </form>
    </section>
  );
}
