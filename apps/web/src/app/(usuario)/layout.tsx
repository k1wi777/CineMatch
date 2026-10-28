import type { ReactNode } from "react";
import { Navbar } from "@/shared/layouts/navbar";

// Layout de usuario: navbar con menú, buscador y campana; el contenido va en <main>.
export default function LayoutUsuario({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-luz focus:px-3 focus:py-2 focus:text-sala"
      >
        Ir al contenido
      </a>
      <Navbar />
      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-8">
        {children}
      </main>
    </>
  );
}
