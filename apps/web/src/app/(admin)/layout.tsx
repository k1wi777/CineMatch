import Link from "next/link";
import type { ReactNode } from "react";
import { GuardSesion } from "@/shared/layouts/guard-sesion";

const ENLACES_ADMIN = [
  { href: "/admin", texto: "Panel" },
  { href: "/admin/moderacion", texto: "Moderación" },
  { href: "/admin/catalogo", texto: "Catálogo" },
] as const;

// Layout de administración. El guard que impide el acceso a usuarios normales llega en FE-0.4.
export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-papel/10 bg-butaca">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-display text-lg">Administración</span>
          <nav aria-label="Administración" className="flex flex-wrap gap-4 text-sm">
            {ENLACES_ADMIN.map((enlace) => (
              <Link key={enlace.href} href={enlace.href} className="text-niebla hover:text-papel">
                {enlace.texto}
              </Link>
            ))}
          </nav>
          <Link href="/" className="ml-auto text-sm text-niebla hover:text-papel">
            Volver a la web
          </Link>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
        <GuardSesion requiereRol="administrador">{children}</GuardSesion>
      </main>
    </div>
  );
}
