import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ayuda",
};

// Guía rápida de CineMatch: qué se puede hacer en cada sección.
export default function PaginaAyuda() {
  return (
    <article className="space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Ayuda</h1>
        <p className="text-papel/85">Una guía rápida para empezar a usar CineMatch.</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Empezar</h2>
        <p className="text-papel/85">
          Crea una cuenta desde <em>Crear cuenta</em> en el inicio de sesión. Si olvidaste tu
          contraseña, usa <em>Recuperar contraseña</em> y te enviaremos un correo para
          restablecerla.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Catálogo</h2>
        <p className="text-papel/85">
          Busca películas y series por título y filtra por tipo o por género. Si un título no está
          en el catálogo, se busca en TMDB y se añade automáticamente.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Biblioteca y reseñas</h2>
        <p className="text-papel/85">
          Desde la ficha de cada título puedes marcarlo como pendiente, viendo, vista o abandonada.
          También puedes calificarlo con estrellas y escribir una reseña, que puede ser pública o
          solo para tus amigos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Amigos y recomendaciones</h2>
        <p className="text-papel/85">
          Busca personas y envíales una solicitud de amistad. Una vez sois amigos, puedes
          recomendarles títulos. Ellos verán la recomendación en su bandeja y podrán aceptarla o
          descartarla.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Tu cuenta y tus datos</h2>
        <p className="text-papel/85">
          En <em>Mis datos</em> puedes cambiar tu información, descargar una copia de tus datos o
          eliminar tu cuenta.
        </p>
      </section>

      <p className="text-sm text-niebla">
        Más detalles sobre el uso de tus datos en la{" "}
        <Link href="/privacidad" className="underline underline-offset-4 hover:text-papel">
          política de privacidad
        </Link>{" "}
        y las normas de uso en los{" "}
        <Link href="/terminos" className="underline underline-offset-4 hover:text-papel">
          términos de uso
        </Link>
        .
      </p>
    </article>
  );
}
