import Link from "next/link";
import type { ReactNode } from "react";

// Layout público: login, registro y recuperación de contraseña. Sin navegación de la aplicación.
export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-6">
        <Link href="/" className="font-display text-xl tracking-tight">
          CineMatch
        </Link>
      </header>
      <main
        id="contenido"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16"
      >
        {children}
      </main>
    </div>
  );
}
