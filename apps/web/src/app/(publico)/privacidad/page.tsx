import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
};

// Política de privacidad de CineMatch. Describe lo que la aplicación hace con los datos.
export default function PaginaPrivacidad() {
  return (
    <article className="space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Política de privacidad</h1>
        <p className="text-sm text-niebla">Última actualización: 29 de octubre de 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Quiénes somos</h2>
        <p className="text-papel/85">
          CineMatch es una aplicación web para registrar películas y series, reseñarlas y
          recomendarlas entre amigos. Es un proyecto académico de la asignatura Desarrollo Web II,
          desarrollado por Camilo David Pacheco Prieto y José Alfredo Padilla Ortiz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Qué datos guardamos</h2>
        <ul className="list-disc space-y-2 pl-5 text-papel/85">
          <li>
            Datos de tu cuenta: nombre, nombre de usuario, correo electrónico y foto de perfil, si
            la subes.
          </li>
          <li>
            Tu contraseña se guarda solo como un resumen cifrado (argon2id). Nadie, tampoco el
            equipo, puede leerla.
          </li>
          <li>
            Tu actividad dentro de la aplicación: biblioteca, reseñas, calificaciones, amistades,
            recomendaciones y notificaciones.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Para qué los usamos</h2>
        <p className="text-papel/85">
          Solo para que la aplicación funcione: iniciar sesión, mostrar tu biblioteca y tus reseñas,
          enviar recomendaciones y avisarte de lo que pasa entre tus amigos. Tu correo se usa para
          recuperar la contraseña y para avisos de la cuenta. No vendemos tus datos ni los usamos
          para publicidad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Quién puede verlos</h2>
        <p className="text-papel/85">
          Tú decides qué es visible. Cada reseña puede ser pública o solo para tus amigos. Tu correo
          solo lo ve tu cuenta, y tu contraseña nunca se muestra a nadie.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Cookies</h2>
        <p className="text-papel/85">
          Usamos una cookie de sesión para mantenerte dentro de tu cuenta. Es necesaria para que la
          aplicación funcione y no se usa para seguimiento ni publicidad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Servicios de terceros</h2>
        <p className="text-papel/85">
          El catálogo de películas y series se obtiene de TMDB. Esas consultas no incluyen datos
          personales de los usuarios. Este producto no está respaldado ni certificado por TMDB.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Tus derechos</h2>
        <p className="text-papel/85">
          Puedes consultar, corregir y eliminar tus datos. Desde la página <em>Mis datos</em> de tu
          perfil puedes descargar una copia de tu información en formato JSON y eliminar tu cuenta.
          Al eliminarla se borran también tu biblioteca, tus amistades, tus recomendaciones y tus
          notificaciones.
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
