"use client";

import { RegistroRespuestaSchema, type Registro } from "@cinematch/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { camposDeError, mensajeDeError, peticion } from "@/shared/api";
import { EstadoError } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { useGeneros } from "@/features/generos/generos";
import {
  CAMPOS_PASO_1,
  MINIMO_GENEROS,
  REGISTRO_FORMULARIO,
  requisitosContrasena,
  type FormularioRegistro,
} from "./registro-campos";

type Paso = 1 | 2;
type Campo = keyof FormularioRegistro;

const CLASE_INPUT =
  "w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 focus:border-luz focus:outline-none";

// Registro en dos pasos (FE-1.1). Los datos del paso 1 se conservan al volver desde el paso 2
// porque viven en un único formulario de React Hook Form.
export function FormularioRegistro() {
  const t = useTranslations("registro");
  const id = useId();
  const router = useRouter();
  const generos = useGeneros();

  const [paso, setPaso] = useState<Paso>(1);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const tituloPaso = useRef<HTMLHeadingElement>(null);
  const montado = useRef(false);
  // Campo que debe recibir el foco tras cambiar de paso (p. ej. un correo ya usado).
  const pendienteFoco = useRef<Campo | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    setFocus,
    setError,
    setValue,
    watch,
    getFieldState,
    formState: { errors },
  } = useForm<FormularioRegistro>({
    resolver: zodResolver(REGISTRO_FORMULARIO),
    mode: "onChange",
    defaultValues: {
      nombre: "",
      username: "",
      correo: "",
      contrasena: "",
      aceptaDatos: false,
      generoIds: [],
    },
  });

  const contrasena = watch("contrasena") ?? "";
  const generoIds = watch("generoIds") ?? [];

  const crear = useMutation({
    mutationFn: (datos: Registro) =>
      peticion("/api/auth/register", {
        metodo: "POST",
        cuerpo: datos,
        esquema: RegistroRespuestaSchema,
      }),
    onSuccess: () => {
      router.replace("/login?aviso=registro-ok");
    },
    onError: (error) => {
      const campos = Object.entries(camposDeError(error)) as [Campo, string][];
      if (campos.length === 0) {
        setErrorGeneral(mensajeDeError(error));
        return;
      }
      setErrorGeneral(null);
      for (const [campo, mensaje] of campos) {
        setError(campo, { type: "server", message: mensaje });
      }
      // El foco va al primer campo con error. Si está en el paso 1 y estamos en el 2, se vuelve primero.
      const primero = campos[0]?.[0];
      if (!primero) return;
      const enPasoUno = CAMPOS_PASO_1.some((campoPaso) => campoPaso === primero);
      if (enPasoUno && paso !== 1) {
        pendienteFoco.current = primero;
        setPaso(1);
      } else {
        setFocus(primero);
      }
    },
  });

  // Tras cambiar de paso, el foco va al título del paso (o al campo pendiente, si hay error).
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (pendienteFoco.current) {
      setFocus(pendienteFoco.current);
      pendienteFoco.current = null;
      return;
    }
    tituloPaso.current?.focus();
  }, [paso, setFocus]);

  async function continuar() {
    const valido = await trigger([...CAMPOS_PASO_1]);
    if (valido) {
      setErrorGeneral(null);
      setPaso(2);
      return;
    }
    const primero = CAMPOS_PASO_1.find((campo) => getFieldState(campo).invalid);
    if (primero) setFocus(primero);
  }

  function enviar(valores: FormularioRegistro) {
    crear.mutate({ ...valores, aceptaDatos: true });
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    if (paso === 1) {
      evento.preventDefault();
      void continuar();
      return;
    }
    void handleSubmit(enviar)(evento);
  }

  function alternarGenero(idGenero: number, marcado: boolean) {
    const actuales = generoIds.filter((valor) => valor !== idGenero);
    setValue("generoIds", marcado ? [...actuales, idGenero] : actuales);
  }

  const requisitos = requisitosContrasena(contrasena);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-niebla">{t("paso", { actual: paso, total: 2 })}</p>
        <h1 ref={tituloPaso} tabIndex={-1} className="font-display text-3xl focus:outline-none">
          {t("titulo")}
        </h1>
        <p className="text-papel/70">{paso === 1 ? t("tituloPaso1") : t("tituloPaso2")}</p>
      </div>

      {errorGeneral ? (
        <p role="alert" className="rounded-sm border border-brasa px-3 py-2 text-sm text-brasa">
          {errorGeneral}
        </p>
      ) : null}

      <form noValidate onSubmit={alEnviar} className="space-y-5">
        {paso === 1 ? (
          <>
            <CampoTexto
              idBase={id}
              nombre="nombre"
              etiqueta={t("nombre")}
              autoComplete="name"
              registro={register}
              error={errors.nombre?.message}
            />
            <CampoTexto
              idBase={id}
              nombre="username"
              etiqueta={t("username")}
              ayuda={t("usernameAyuda")}
              autoComplete="username"
              registro={register}
              error={errors.username?.message}
            />
            <CampoTexto
              idBase={id}
              nombre="correo"
              etiqueta={t("correo")}
              tipo="email"
              autoComplete="email"
              registro={register}
              error={errors.correo?.message}
            />
            <div className="space-y-1.5">
              <CampoTexto
                idBase={id}
                nombre="contrasena"
                etiqueta={t("contrasena")}
                tipo="password"
                autoComplete="new-password"
                registro={register}
                error={errors.contrasena?.message}
              />
              <div className="space-y-1">
                <p className="text-sm text-niebla">{t("requisitos")}</p>
                <ul className="space-y-0.5 text-sm">
                  {requisitos.map((requisito) => (
                    <li
                      key={requisito.clave}
                      className={requisito.cumple ? "text-musgo" : "text-niebla"}
                    >
                      {requisito.cumple ? "✓ " : "· "}
                      {t(requisito.clave)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  aria-invalid={errors.aceptaDatos ? "true" : undefined}
                  aria-describedby={`${id}-autorizacion`}
                  className="mt-1 h-4 w-4 accent-luz"
                  {...register("aceptaDatos")}
                />
                <span id={`${id}-autorizacion`} className="text-papel/85">
                  {t("autorizacion")}
                </span>
              </label>
              {errors.aceptaDatos ? (
                <p className="text-sm text-brasa">{errors.aceptaDatos.message}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void continuar()}
              className="w-full rounded-sm bg-luz px-4 py-2 font-semibold text-sala"
            >
              {t("continuar")}
            </button>
          </>
        ) : (
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm text-niebla">{t("generos")}</legend>
            <p className="text-sm text-papel/70">{t("generosAyuda", { minimo: MINIMO_GENEROS })}</p>

            {generos.isPending ? (
              <div role="status" aria-label={t("generos")} className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }, (_, indice) => (
                  <Skeleton key={indice} className="h-10 w-full" />
                ))}
              </div>
            ) : generos.isError ? (
              <EstadoError
                mensaje={t("generosError")}
                onReintentar={() => void generos.refetch()}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {generos.data.map((genero) => {
                  const marcado = generoIds.includes(genero.id);
                  return (
                    <label
                      key={genero.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                        marcado ? "border-luz text-papel" : "border-papel/15 text-niebla"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(evento) => alternarGenero(genero.id, evento.target.checked)}
                        className="h-4 w-4 accent-luz"
                      />
                      {genero.nombre}
                    </label>
                  );
                })}
              </div>
            )}

            <p role="status" aria-live="polite" className="text-sm text-papel/85">
              {t("contador", { elegidos: generoIds.length, minimo: MINIMO_GENEROS })}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPaso(1)}
                disabled={crear.isPending}
                className="rounded-sm border border-papel/30 px-4 py-2 text-sm disabled:opacity-60 sm:flex-1"
              >
                {t("volver")}
              </button>
              <button
                type="submit"
                disabled={crear.isPending || generoIds.length < MINIMO_GENEROS}
                aria-busy={crear.isPending || undefined}
                className="rounded-sm bg-luz px-4 py-2 font-semibold text-sala disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
              >
                {crear.isPending ? t("creando") : t("crear")}
              </button>
            </div>
          </fieldset>
        )}
      </form>

      <p className="text-center text-sm text-niebla">{t("yaTienesCuenta")}</p>
    </section>
  );
}

type CampoDeTexto = "nombre" | "username" | "correo" | "contrasena";

function CampoTexto({
  idBase,
  nombre,
  etiqueta,
  ayuda,
  tipo = "text",
  autoComplete,
  registro,
  error,
}: {
  idBase: string;
  nombre: CampoDeTexto;
  etiqueta: string;
  ayuda?: string;
  tipo?: string;
  autoComplete: string;
  registro: UseFormRegister<FormularioRegistro>;
  error?: string;
}) {
  const idCampo = `${idBase}-${nombre}`;
  const idError = `${idCampo}-error`;
  const idAyuda = `${idCampo}-ayuda`;
  const describedBy =
    [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={idCampo} className="block text-sm text-niebla">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        type={tipo}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={CLASE_INPUT}
        {...registro(nombre)}
      />
      {ayuda ? (
        <p id={idAyuda} className="text-xs text-niebla">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={idError} className="text-sm text-brasa">
          {error}
        </p>
      ) : null}
    </div>
  );
}
