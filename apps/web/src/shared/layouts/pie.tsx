import Image from "next/image";
import Link from "next/link";

// Pie común de todas las páginas: identidad del proyecto, autores, aviso de TMDB y enlace a la política de privacidad.
export function Pie() {
  return (
    <footer className="mt-16 border-t border-papel/10 bg-sala">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-6">
            <Image
              src="/logo-cinematch.png"
              alt="CineMatch"
              width={1680}
              height={261}
              className="h-16 w-auto"
            />
            <Image
              src="/logo-tmdb.png"
              alt="The Movie Database (TMDB)"
              width={700}
              height={438}
              className="h-12 w-auto rounded-sm"
            />
            <Image
              src="/logo-dwii.png"
              alt="DW II"
              width={1536}
              height={1024}
              className="h-12 w-auto"
            />
          </div>
          <p className="text-sm text-niebla">
            Reseñas, calificaciones y recomendaciones de películas y series entre amigos.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-niebla">Proyecto de Desarrollo Web II</p>
          <p>Camilo David Pacheco Prieto</p>
          <p>José Alfredo Padilla Ortiz</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/privacidad"
              className="inline-block underline underline-offset-4 hover:text-papel"
            >
              Política de privacidad
            </Link>
            <Link
              href="/terminos"
              className="inline-block underline underline-offset-4 hover:text-papel"
            >
              Términos de uso
            </Link>
            <Link
              href="/ayuda"
              className="inline-block underline underline-offset-4 hover:text-papel"
            >
              Ayuda
            </Link>
          </div>
          <p className="text-niebla">
            Los datos de películas y series provienen de TMDB. Este producto no está respaldado ni
            certificado por TMDB.
          </p>
        </div>
      </div>

      <p className="border-t border-papel/10 px-4 py-4 text-center text-xs text-niebla">
        © {new Date().getFullYear()} CineMatch
      </p>
    </footer>
  );
}
