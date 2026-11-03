"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useCerrarSesion } from "@/features/auth/cerrar-sesion";
import { useSesion } from "@/features/auth/sesion";
import { usePerfil } from "@/features/perfil/perfil";
import { useContadorSolicitudes } from "@/features/amigos/amigos";
import { useContadorNoLeidas } from "@/features/notificaciones/notificaciones";
import { SelectorRegion } from "@/features/catalogo/selector-region";
import { Avatar } from "@/shared/ui/avatar";

// Aviso con el número de solicitudes recibidas pendientes, junto a «Amigos».
function Contador({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <span className="ml-1.5 inline-block min-w-5 rounded-full bg-luz px-1 text-center text-xs font-semibold text-sala">
      {total}
    </span>
  );
}

// Enlaces del menú principal. «Mi perfil» vive en el menú del avatar.
export const ENLACES_PRINCIPALES = [
  { href: "/", texto: "Inicio" },
  { href: "/catalogo", texto: "Catálogo" },
  { href: "/biblioteca", texto: "Biblioteca" },
  { href: "/amigos", texto: "Amigos" },
  { href: "/recomendaciones", texto: "Recomendaciones" },
] as const;

// En móvil el menú desplegable sigue mostrando «Mi perfil» junto a los demás enlaces.
const ENLACES_MOVIL = [...ENLACES_PRINCIPALES, { href: "/perfil", texto: "Mi perfil" }] as const;

// Opciones del menú del avatar (escritorio).
const OPCIONES_USUARIO = [
  { href: "/perfil", texto: "Mi perfil" },
  { href: "/perfil/resenas", texto: "Mis reseñas" },
  { href: "/mis-datos", texto: "Mis datos" },
] as const;

// Una ruta está activa si coincide exacta o si es una sección suya (p. ej. /catalogo/12).
export function estaActiva(ruta: string, href: string): boolean {
  if (href === "/") return ruta === "/";
  return ruta === href || ruta.startsWith(`${href}/`);
}

export function Navbar() {
  const ruta = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const idMenu = useId();
  const cerrarSesion = useCerrarSesion();
  const sesion = useSesion();
  const perfil = usePerfil();
  const solicitudesPendientes = useContadorSolicitudes().data ?? 0;
  const notificacionesSinLeer = useContadorNoLeidas().data ?? 0;
  const contenedorUsuario = useRef<HTMLDivElement>(null);

  // Los menús se cierran con Escape y al cambiar de página.
  useEffect(() => {
    setMenuAbierto(false);
    setMenuUsuarioAbierto(false);
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setMenuAbierto(false);
        setMenuUsuarioAbierto(false);
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [ruta]);

  // El menú del avatar también se cierra al pulsar fuera de él.
  useEffect(() => {
    if (!menuUsuarioAbierto) return;
    const alPulsarFuera = (evento: MouseEvent) => {
      if (!contenedorUsuario.current?.contains(evento.target as Node)) {
        setMenuUsuarioAbierto(false);
      }
    };
    document.addEventListener("mousedown", alPulsarFuera);
    return () => document.removeEventListener("mousedown", alPulsarFuera);
  }, [menuUsuarioAbierto]);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const texto = String(datos.get("q") ?? "").trim();
    router.push(texto ? `/catalogo?q=${encodeURIComponent(texto)}` : "/catalogo");
  }

  const usuario = sesion.data;

  return (
    <header className="sticky top-0 z-40 border-b border-papel/10 bg-sala/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-2xl tracking-tight">
          <span className="text-white">Cine</span>
          <span className="text-luz">Match</span>
        </Link>

        <nav aria-label="Principal" className="ml-4 hidden md:block lg:ml-8">
          <ul className="flex items-center gap-5 whitespace-nowrap text-sm">
            {ENLACES_PRINCIPALES.map((enlace) => {
              const activa = estaActiva(ruta, enlace.href);
              return (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    aria-current={activa ? "page" : undefined}
                    className={`border-b pb-0.5 transition-colors ${activa ? "border-luz text-papel" : "border-transparent text-niebla hover:text-papel"}`}
                  >
                    {enlace.texto}
                    {enlace.href === "/amigos" ? <Contador total={solicitudesPendientes} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <SelectorRegion />
          <form role="search" onSubmit={buscar} className="w-64">
            <label htmlFor={`${idMenu}-buscar`} className="sr-only">
              Buscar títulos
            </label>
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-niebla"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id={`${idMenu}-buscar`}
                name="q"
                type="search"
                placeholder="Buscar títulos"
                className="w-full rounded-sm border border-papel/15 bg-butaca py-2 pl-9 pr-3 text-sm placeholder:text-niebla focus:border-luz focus:outline-none"
              />
            </div>
          </form>
        </div>

        <Link
          href="/notificaciones"
          aria-label={`Notificaciones${notificacionesSinLeer ? `, ${notificacionesSinLeer} sin leer` : ""}`}
          className="relative rounded-sm p-2 text-niebla hover:text-papel md:ml-0"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {notificacionesSinLeer > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-luz px-1 text-center text-xs font-semibold text-sala">
              {notificacionesSinLeer}
            </span>
          ) : null}
        </Link>

        {usuario ? (
          <div ref={contenedorUsuario} className="relative hidden md:block">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuUsuarioAbierto}
              aria-controls={`${idMenu}-usuario`}
              aria-label={`Menú de ${usuario.nombre}`}
              onClick={() => setMenuUsuarioAbierto((abierto) => !abierto)}
              className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-papel/20 hover:ring-papel/50"
            >
              <Avatar nombre={usuario.nombre} url={perfil.data?.avatarUrl} tamano={32} />
            </button>

            {menuUsuarioAbierto ? (
              <div
                id={`${idMenu}-usuario`}
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-sm border border-papel/10 bg-butaca shadow-foco"
              >
                <p className="border-b border-papel/10 px-4 py-3">
                  <span className="block font-semibold text-papel">{usuario.nombre}</span>
                  <span className="block text-sm text-niebla">@{usuario.username}</span>
                </p>
                <ul className="py-1">
                  {OPCIONES_USUARIO.map((opcion) => (
                    <li key={opcion.href} role="none">
                      <Link
                        href={opcion.href}
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-papel/85 hover:bg-telon hover:text-papel"
                      >
                        {opcion.texto}
                      </Link>
                    </li>
                  ))}
                  {usuario.rol === "administrador" ? (
                    <li role="none">
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-papel/85 hover:bg-telon hover:text-papel"
                      >
                        Administración
                      </Link>
                    </li>
                  ) : null}
                </ul>
                <div className="border-t border-papel/10 py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => cerrarSesion.mutate()}
                    disabled={cerrarSesion.isPending}
                    className="block w-full px-4 py-2 text-left text-sm text-niebla hover:bg-telon hover:text-papel disabled:opacity-60"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          aria-expanded={menuAbierto}
          aria-controls={`${idMenu}-menu`}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          className="rounded-sm border border-papel/20 px-3 py-2 text-sm md:hidden"
        >
          {menuAbierto ? "Cerrar" : "Menú"}
        </button>
      </div>

      {menuAbierto ? (
        <div id={`${idMenu}-menu`} className="border-t border-papel/10 bg-butaca md:hidden">
          <div className="flex flex-col gap-3 px-4 pt-4">
            <SelectorRegion className="self-start" />
            <form role="search" onSubmit={buscar}>
              <label htmlFor={`${idMenu}-buscar-movil`} className="sr-only">
                Buscar títulos
              </label>
              <input
                id={`${idMenu}-buscar-movil`}
                name="q"
                type="search"
                placeholder="Buscar títulos"
                className="w-full rounded-sm border border-papel/15 bg-sala px-3 py-2 text-base placeholder:text-niebla focus:border-luz focus:outline-none"
              />
            </form>
          </div>
          <nav aria-label="Principal móvil" className="px-4 py-4">
            <ul className="flex flex-col gap-1">
              {ENLACES_MOVIL.map((enlace) => {
                const activa = estaActiva(ruta, enlace.href);
                return (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      aria-current={activa ? "page" : undefined}
                      className={`block py-3 font-display text-xl ${activa ? "text-luz" : "text-papel"}`}
                    >
                      {enlace.texto}
                      {enlace.href === "/amigos" ? (
                        <Contador total={solicitudesPendientes} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => cerrarSesion.mutate()}
              disabled={cerrarSesion.isPending}
              className="mt-4 block py-3 text-sm text-niebla hover:text-papel disabled:opacity-60"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
