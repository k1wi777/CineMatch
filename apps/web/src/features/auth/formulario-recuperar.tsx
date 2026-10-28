"use client";

import { SolicitarRecuperacionSchema, type SolicitarRecuperacion } from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { mensajeDeError, peticion } from "@/shared/api";

// Solicitud de enlace (FE-1.3). Responde igual exista o no el correo: el mensaje no cambia.
export function FormularioRecuperar() {
  const t = useTranslations("recuperar");
  const id = useId();
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SolicitarRecuperacion>({ resolver: zodResolver(SolicitarRecuperacionSchema) });

  const solicitar = useMutation({
    mutationFn: (datos: SolicitarRecuperacion) =>
      peticion("/api/auth/forgot-password", { metodo: "POST", cuerpo: datos }),
    onSuccess: () => setEnviado(true),
  });

  if (enviado) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        <p role="status" className="text-papel/85">
          {t("enviado")}
        </p>
        <Link
          href="/login"
          className="text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("volver")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl">{t("titulo")}</h1>
        <p className="text-niebla">{t("texto")}</p>
      </div>

      {solicitar.isError ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {mensajeDeError(solicitar.error)}
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={handleSubmit((datos) => solicitar.mutate(datos))}
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

        <button
          type="submit"
          disabled={solicitar.isPending}
          aria-busy={solicitar.isPending || undefined}
          className="w-full rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {solicitar.isPending ? t("enviando") : t("enviar")}
        </button>
      </form>

      <Link
        href="/login"
        className="block text-center text-sm text-niebla underline underline-offset-4 hover:text-papel"
      >
        {t("volver")}
      </Link>
    </section>
  );
}
