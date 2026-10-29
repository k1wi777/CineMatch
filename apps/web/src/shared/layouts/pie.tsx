import Link from "next/link";

// Pie común de todas las páginas: identidad del proyecto, autores, aviso de TMDB y enlace a la política de privacidad.
export function Pie() {
  return (
    <footer className="mt-16 border-t border-papel/10 bg-sala">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-2">
          <p className="font-display text-xl">CineMatch</p>
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
          <Link
            href="/privacidad"
            className="inline-block underline underline-offset-4 hover:text-papel"
          >
            Política de privacidad
          </Link>
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
