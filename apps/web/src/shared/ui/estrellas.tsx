"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { formatoCalificacion } from "../formato";
import {
  ajustarCalificacion,
  calificacionDesdeClic,
  MAX_CALIFICACION,
  MIN_CALIFICACION,
  rellenoEstrella,
} from "./estrellas-logica";

// Calificación en medios puntos. Es un control "slider": se maneja con ratón (mitad izquierda = medio punto)
// y con teclado (flechas, Inicio, Fin).
export function Estrellas({
  valor,
  onCambio,
  etiqueta,
}: {
  valor: number;
  onCambio?: (nuevo: number) => void;
  etiqueta: string;
}) {
  const [previa, setPrevia] = useState<number | null>(null);
  const mostrado = previa ?? valor;
  const interactivo = onCambio !== undefined;

  function alPulsar(evento: KeyboardEvent<HTMLDivElement>) {
    if (!onCambio) return;
    const nuevo = ajustarCalificacion(valor, evento.key);
    if (nuevo !== valor) {
      evento.preventDefault();
      onCambio(nuevo);
    }
  }

  function calificacionBajo(evento: MouseEvent<HTMLSpanElement>, estrella: number): number {
    const rect = evento.currentTarget.getBoundingClientRect();
    return calificacionDesdeClic(estrella, evento.clientX - rect.left, rect.width);
  }

  return (
    <div
      role="slider"
      tabIndex={interactivo ? 0 : undefined}
      aria-label={etiqueta}
      aria-valuemin={MIN_CALIFICACION}
      aria-valuemax={MAX_CALIFICACION}
      aria-valuenow={valor}
      aria-valuetext={`${formatoCalificacion(valor)} de ${MAX_CALIFICACION}`}
      aria-readonly={!interactivo}
      onKeyDown={alPulsar}
      onMouseLeave={() => setPrevia(null)}
      className="inline-flex items-center gap-0.5 rounded-sm text-2xl leading-none"
    >
      {Array.from({ length: MAX_CALIFICACION }, (_, indice) => (
        <span
          key={indice}
          aria-hidden="true"
          onMouseMove={
            interactivo ? (evento) => setPrevia(calificacionBajo(evento, indice + 1)) : undefined
          }
          onClick={
            interactivo ? (evento) => onCambio(calificacionBajo(evento, indice + 1)) : undefined
          }
          className={`relative inline-block select-none text-papel/25 ${interactivo ? "cursor-pointer" : ""}`}
        >
          ★
          <span
            className="absolute inset-y-0 left-0 overflow-hidden text-luz"
            style={{ width: `${rellenoEstrella(mostrado, indice) * 100}%` }}
          >
            ★
          </span>
        </span>
      ))}
    </div>
  );
}
