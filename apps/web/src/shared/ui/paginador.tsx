import Link from "next/link";

// Paginador con enlaces reales (cada página tiene su URL). La página actual va marcada para lectores de pantalla.
export function Paginador({
  pagina,
  total,
  tamano,
  construirHref,
}: {
  pagina: number;
  total: number;
  tamano: number;
  construirHref: (pagina: number) => string;
}) {
  const ultima = Math.max(1, Math.ceil(total / tamano));
  if (ultima <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-4 text-sm">
      {pagina > 1 ? (
        <Link href={construirHref(pagina - 1)} rel="prev" className="text-niebla hover:text-papel">
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className="text-papel/30">
          Anterior
        </span>
      )}
      <span>
        Página <span aria-current="page">{pagina}</span> de {ultima}
      </span>
      {pagina < ultima ? (
        <Link href={construirHref(pagina + 1)} rel="next" className="text-niebla hover:text-papel">
          Siguiente
        </Link>
      ) : (
        <span aria-disabled="true" className="text-papel/30">
          Siguiente
        </span>
      )}
    </nav>
  );
}
