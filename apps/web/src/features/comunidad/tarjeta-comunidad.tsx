import type { RecomendacionComunidad } from "@cinematch/shared";
import { TarjetaTitulo } from "@/shared/ui/tarjeta-titulo";
import { textoOrigen, textoPromedio } from "./origen";

// Tarjeta de una recomendación general: póster y título, con el origen y el promedio de la comunidad.
export function TarjetaComunidad({ titulo }: { titulo: RecomendacionComunidad }) {
  const promedio = textoPromedio(titulo.promedio, titulo.calificaciones);
  return (
    <div className="space-y-1">
      <TarjetaTitulo
        id={titulo.id}
        titulo={titulo.titulo}
        anio={titulo.anio}
        posterUrl={titulo.posterUrl}
        generos={titulo.generos.map((genero) => genero.nombre)}
      />
      <p className="text-xs text-luz">{textoOrigen(titulo.origen)}</p>
      {promedio ? <p className="text-xs text-niebla">{promedio}</p> : null}
    </div>
  );
}
