"use client";

import { useId } from "react";
import { useRegion } from "./region";

// Selector de país para los destacados del inicio, con icono de idioma. Se guarda en el navegador.
export function SelectorRegion({ className = "" }: { className?: string }) {
  const id = useId();
  const { region, cambiar, regiones } = useRegion();

  return (
    <div className={`relative flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        País de los destacados
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-2.5 h-4 w-4 text-niebla"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
      </svg>
      <select
        id={id}
        value={region}
        onChange={(evento) => cambiar(evento.target.value as typeof region)}
        className="w-32 rounded-sm border border-papel/15 bg-butaca py-2 pl-8 pr-3 text-sm focus:border-luz focus:outline-none"
      >
        {regiones.map((opcion) => (
          <option key={opcion.codigo} value={opcion.codigo}>
            {opcion.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
