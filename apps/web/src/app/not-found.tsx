import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-neutral-500">Error 404</p>
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Puede que el enlace esté roto o que la página ya no exista.
      </p>
      <Link
        href="/"
        className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
