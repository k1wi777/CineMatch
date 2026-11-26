import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso",
};

// Términos de uso de CineMatch. Describe las reglas básicas de uso de la aplicación.
export default function PaginaTerminos() {
  return (
    <article className="space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Términos de uso</h1>
        <p className="text-sm text-niebla">Última actualización: 29 de octubre de 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Qué es CineMatch</h2>
        <p className="text-papel/85">
          CineMatch es una aplicación web para registrar películas y series, reseñarlas y
          recomendarlas entre amigos. Es un proyecto académico de la asignatura Desarrollo Web II.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Tu cuenta</h2>
        <ul className="list-disc space-y-2 pl-5 text-papel/85">
          <li>
            Eres responsable de la información que das al registrarte y de mantener tu contraseña en
            secreto.
          </li>
          <li>Una cuenta es personal. No la compartas ni la uses para suplantar a otra persona.</li>
          <li>
            Puedes eliminar tu cuenta en cualquier momento desde la página <em>Mis datos</em>.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Contenido y conducta</h2>
        <p className="text-papel/85">
          Las reseñas, etiquetas y comentarios deben ser respetuosos. No se permite el insulto, el
          acoso, el contenido ofensivo ni el spam. El equipo puede moderar o retirar el contenido
          que incumpla estas reglas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Datos de películas y series</h2>
        <p className="text-papel/85">
          La información de títulos, carteles, fondos y tráileres proviene de TMDB. Sus derechos
          pertenecen a sus respectivos titulares. Este producto no está respaldado ni certificado
          por TMDB.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Limitación de responsabilidad</h2>
        <p className="text-papel/85">
          CineMatch se ofrece tal cual, como proyecto académico. No garantizamos que el servicio
          esté siempre disponible ni que los datos externos sean completos o exactos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Cambios</h2>
        <p className="text-papel/85">
          Podemos actualizar estos términos. La fecha de la parte superior indica la última
          revisión. Para conocer cómo tratamos tus datos, consulta la{" "}
          <Link href="/privacidad" className="underline underline-offset-4 hover:text-papel">
            política de privacidad
          </Link>
          .
        </p>
      </section>

      <p className="text-sm text-niebla">
        <Link href="/login" className="underline underline-offset-4 hover:text-papel">
          Volver al inicio de sesión
        </Link>
      </p>
    </article>
  );
}
