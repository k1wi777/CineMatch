import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// Layout público: login, registro y recuperación de contraseña. Sin navegación de la aplicación.
export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main
        id="contenido"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
      >
        <Link href="/" aria-label="CineMatch, inicio" className="mb-8 self-center">
          <Image
            src="/logo-cinematch.png"
            alt=""
            width={1680}
            height={261}
            priority
            className="h-auto w-96 max-w-full"
          />
        </Link>
        {children}
      </main>
    </div>
  );
}
