"use client";

import { RestablecerContrasenaSchema } from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, mensajeDeError, peticion } from "@/shared/api";
import { FORMULARIO_RESTABLECER, type FormularioRestablecer } from "./recuperar-campos";
import { requisitosContrasena } from "./registro-campos";

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Nueva contraseña desde el enlace del correo (FE-1.3). El token viene de la URL, leído en el servidor.
// Si falta, venció o ya se usó, se muestra un estado claro con la opción de pedir otro enlace.
export function FormularioRestablecer({ token }: { token?: string }) {
  const t = useTranslations("recuperar");
  const tRegistro = useTranslations("registro");
  const id = useId();
  const router = useRouter();
  const [enlaceInvalido, setEnlaceInvalido] = useState<string | null>(
    token ? null : t("invalidoSinToken"),
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormularioRestablecer>({
    resolver: zodResolver(FORMULARIO_RESTABLECER),
    mode: "onChange",
    defaultValues: { contrasena: "", confirmacion: "" },
  });

  const contrasena = watch("contrasena") ?? "";

  const restablecer = useMutation({
    mutationFn: (datos: FormularioRestablecer) =>
      peticion("/api/auth/reset-password", {
        metodo: "POST",
        cuerpo: RestablecerContrasenaSchema.parse({ token, contrasena: datos.contrasena }),
      }),
    onSuccess: () => {
      router.replace("/login?aviso=contrasena-restablecida");
    },
    onError: (error) => {
      // Un enlace inválido, vencido o ya usado no se arregla reintentando: se ofrece pedir otro.
      if (error instanceof ApiError && error.code.startsWith("RESET_TOKEN")) {
        setEnlaceInvalido(mensajeDeError(error));
      }
    },
  });

  if (enlaceInvalido) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-3xl">{t("invalidoTitulo")}</h1>
        <p role="alert" className="text-papel/85">
          {enlaceInvalido}
        </p>
        <Link
          href="/recuperar"
          className="block rounded-sm bg-luz px-4 py-2 text-center font-semibold text-sala"
        >
          {t("pedirOtro")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl">{t("tituloRestablecer")}</h1>
        <p className="text-niebla">{t("textoRestablecer")}</p>
      </div>

      {restablecer.isError && !enlaceInvalido ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {mensajeDeError(restablecer.error)}
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={handleSubmit((datos) => restablecer.mutate(datos))}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label htmlFor={`${id}-contrasena`} className="block text-sm text-niebla">
            {t("contrasena")}
          </label>
          <input
            id={`${id}-contrasena`}
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.contrasena ? "true" : undefined}
            aria-describedby={`${id}-requisitos`}
            className={CLASE_INPUT}
            {...register("contrasena")}
          />
          <ul id={`${id}-requisitos`} className="space-y-0.5 text-sm">
            {requisitosContrasena(contrasena).map((requisito) => (
              <li key={requisito.clave} className={requisito.cumple ? "text-musgo" : "text-niebla"}>
                {requisito.cumple ? "✓ " : "· "}
                {tRegistro(requisito.clave)}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-confirmacion`} className="block text-sm text-niebla">
            {t("confirmacion")}
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
          disabled={restablecer.isPending}
          aria-busy={restablecer.isPending || undefined}
          className="w-full rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {restablecer.isPending ? t("guardando") : t("guardar")}
        </button>
      </form>
    </section>
  );
}
