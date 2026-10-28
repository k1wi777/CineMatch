import Link from "next/link";
import { EstadoVacio } from "@/shared/ui/estados";

export default function Inicio() {
  return (
    <EstadoVacio
      titulo="Todavía no hay títulos en tu sala"
      texto="Cuando empieces a calificar películas y series, aquí verás lo que tus amigos están viendo y lo que te recomiendan."
      accion={
        <Link
          href="/catalogo"
          className="rounded-sm bg-luz px-4 py-2 text-sm font-semibold text-sala"
        >
          Explorar el catálogo
        </Link>
      }
    />
  );
}
