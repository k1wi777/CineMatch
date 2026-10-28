"use client";

import {
  LoginSchema,
  UsuarioSesionSchema,
  type LoginRequest,
  type UsuarioSesion,
} from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, mensajeDeError, peticion } from "@/shared/api";
import { destinoTrasLogin, formatoCuentaAtras, segundosRestantes } from "./bloqueo";
import { claves as clavesSesion } from "./sesion";

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Inicio de sesión (FE-1.2). El mensaje de credenciales es el mismo para correo inexistente y contraseña errónea.
// Si la cuenta está bloqueada, el botón se deshabilita hasta que la cuenta cuenta atrás llegue a cero.
export function FormularioLogin({ siguiente }: { siguiente?: string }) {
  const t = useTranslations("login");
  const id = useId();
  const router = useRouter();
  const cliente = useQueryClient();

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [bloqueadaHasta, setBloqueadaHasta] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const restantes = bloqueadaHasta === null ? 0 : segundosRestantes(bloqueadaHasta, ahora);
  const bloqueada = restantes > 0;

  // La cuenta atrás avanza cada segundo mientras dura el bloqueo y se detiene al llegar a cero.
  useEffect(() => {
    if (!bloqueada) return;
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [bloqueada]);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(LoginSchema) });

  const entrar = useMutation({
    mutationFn: (datos: LoginRequest) =>
      peticion<UsuarioSesion>("/api/auth/login", {
        metodo: "POST",
        cuerpo: datos,
        esquema: UsuarioSesionSchema,
      }),
    onSuccess: (usuario) => {
      // La sesión queda en caché: el guard no vuelve a pedirla y no hay un parpadeo de login.
      cliente.setQueryData([...clavesSesion.todas, "sesion"], usuario);
      router.replace(destinoTrasLogin(usuario.rol, siguiente));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "ACCOUNT_LOCKED" && error.retryAfterSeconds) {
        setAhora(Date.now());
        setBloqueadaHasta(Date.now() + error.retryAfterSeconds * 1000);
        setErrorGeneral(t("bloqueada"));
        return;
      }
      setErrorGeneral(mensajeDeError(error));
      setFocus("contrasena");
    },
  });

  const enviando = entrar.isPending;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl">{t("titulo")}</h1>

      {errorGeneral ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {errorGeneral}
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={handleSubmit((datos) => entrar.mutate(datos))}
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
            className={CLASE_INPUT}
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
            className={CLASE_INPUT}
            {...register("contrasena")}
          />
          {errors.contrasena ? (
            <p id={`${id}-contrasena-error`} className="text-sm text-brasa">
              {errors.contrasena.message}
            </p>
          ) : null}
        </div>

        {bloqueada ? (
          <p aria-live="off" className="text-sm text-niebla">
            {t("contadorBloqueo", { tiempo: formatoCuentaAtras(restantes) })}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enviando || bloqueada}
          aria-busy={enviando || undefined}
          className="w-full rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? t("entrando") : t("entrar")}
        </button>
      </form>

      <p className="text-center text-sm text-niebla">
        {t("sinCuenta")}{" "}
        <Link href="/registro" className="text-papel underline underline-offset-4 hover:text-luz">
          {t("registrate")}
        </Link>
      </p>
    </section>
  );
}
