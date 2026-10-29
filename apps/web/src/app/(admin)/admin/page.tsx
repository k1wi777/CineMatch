import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Administración",
};

const SECCIONES = [
  {
    href: "/admin/moderacion",
    titulo: "Moderación de reseñas",
    texto: "Revisa reseñas, filtra y oculta o restablece las que incumplan las normas.",
  },
  {
    href: "/admin/catalogo",
    titulo: "Catálogo",
    texto: "Sincroniza el catálogo con la fuente externa y revisa el resultado.",
  },
];

export default function PanelAdmin() {
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl">Panel de administración</h1>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECCIONES.map((seccion) => (
          <li key={seccion.href}>
            <Link
              href={seccion.href}
              className="block h-full rounded-sm border border-papel/10 bg-butaca p-5 hover:border-luz"
            >
              <span className="font-display text-xl">{seccion.titulo}</span>
              <span className="mt-2 block text-sm text-niebla">{seccion.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
