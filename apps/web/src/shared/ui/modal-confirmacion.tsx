"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { siguienteFoco } from "./modal-logica";

// Modal de confirmación: el foco entra en el diálogo, Tab no sale de él, Escape cierra
// y al cerrar el foco vuelve al elemento que lo abrió.
export function ModalConfirmacion({
  abierto,
  titulo,
  texto,
  textoConfirmar,
  textoCancelar,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  texto: ReactNode;
  textoConfirmar: string;
  textoCancelar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const dialogo = useRef<HTMLDivElement>(null);

  // Al abrir se guarda el elemento activo y se enfoca el primer botón; al cerrar se devuelve el foco.
  useEffect(() => {
    if (!abierto) return;
    const origen = document.activeElement as HTMLElement | null;
    dialogo.current?.querySelector<HTMLElement>("button")?.focus();
    return () => origen?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCancelar();
        return;
      }
      if (evento.key !== "Tab" || !dialogo.current) return;
      const botones = Array.from(dialogo.current.querySelectorAll<HTMLElement>("button"));
      const destino = siguienteFoco(
        botones.length,
        botones.indexOf(document.activeElement as HTMLElement),
        evento.shiftKey,
      );
      if (destino >= 0) {
        evento.preventDefault();
        botones[destino]?.focus();
      }
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto, onCancelar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sala/80 px-4">
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        className="w-full max-w-md space-y-4 rounded-sm bg-telon p-6 shadow-foco"
      >
        <h2 id={`${id}-titulo`} className="font-display text-xl">
          {titulo}
        </h2>
        <p id={`${id}-texto`} className="text-papel/85">
          {texto}
        </p>
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-sm border border-papel/30 px-4 py-2 text-sm"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-sm bg-brasa px-4 py-2 text-sm font-semibold text-sala"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
