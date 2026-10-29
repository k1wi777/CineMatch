"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useCerrarSesion } from "@/features/auth/cerrar-sesion";
import { useContadorSolicitudes } from "@/features/amigos/amigos";
import { useContadorNoLeidas } from "@/features/notificaciones/notificaciones";

// Aviso con el número de solicitudes recibidas pendientes, junto a «Amigos».
function Contador({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <span className="ml-1.5 inline-block min-w-5 rounded-full bg-luz px-1 text-center text-xs font-semibold text-sala">
      {total}
    </span>
  );
}

export const ENLACES_PRINCIPALES = [
  { href: "/", texto: "Inicio" },
  { href: "/catalogo", texto: "Catálogo" },
  { href: "/biblioteca", texto: "Biblioteca" },
  { href: "/amigos", texto: "Amigos" },
  { href: "/recomendaciones", texto: "Recomendaciones" },
  { href: "/perfil", texto: "Mi perfil" },
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
  const idMenu = useId();
  const cerrarSesion = useCerrarSesion();
  const solicitudesPendientes = useContadorSolicitudes().data ?? 0;
  const notificacionesSinLeer = useContadorNoLeidas().data ?? 0;

  // El menú móvil se cierra con Escape y al cambiar de página.
  useEffect(() => {
    setMenuAbierto(false);
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [ruta]);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const texto = String(datos.get("q") ?? "").trim();
    router.push(texto ? `/catalogo?q=${encodeURIComponent(texto)}` : "/catalogo");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-papel/10 bg-sala/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl tracking-tight">
          CineMatch
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-5 text-sm">
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

        <form role="search" onSubmit={buscar} className="ml-auto hidden w-64 md:block">
          <label htmlFor={`${idMenu}-buscar`} className="sr-only">
            Buscar títulos
          </label>
          <input
            id={`${idMenu}-buscar`}
            name="q"
            type="search"
            placeholder="Buscar títulos"
            className="w-full rounded-sm border border-papel/15 bg-butaca px-3 py-2 text-sm placeholder:text-niebla focus:border-luz focus:outline-none"
          />
        </form>

        <Link
          href="/notificaciones"
          aria-label={`Notificaciones${notificacionesSinLeer ? `, ${notificacionesSinLeer} sin leer` : ""}`}
          className="relative ml-auto rounded-sm p-2 text-niebla hover:text-papel md:ml-0"
        >
          <span aria-hidden="true">●</span>
          {notificacionesSinLeer > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-luz px-1 text-center text-xs font-semibold text-sala">
              {notificacionesSinLeer}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={() => cerrarSesion.mutate()}
          disabled={cerrarSesion.isPending}
          className="hidden rounded-sm px-2 py-2 text-sm text-niebla hover:text-papel disabled:opacity-60 md:inline-block"
        >
          Cerrar sesión
        </button>

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
          <form role="search" onSubmit={buscar} className="px-4 pt-4">
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
          <nav aria-label="Principal móvil" className="px-4 py-4">
            <ul className="flex flex-col gap-1">
              {ENLACES_PRINCIPALES.map((enlace) => {
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
