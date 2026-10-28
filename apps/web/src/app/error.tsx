"use client";

import { useEffect } from "react";

export default function ErrorPagina({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle técnico se registra en consola del navegador; nunca se muestra al usuario.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Reintentar
      </button>
    </main>
  );
}
