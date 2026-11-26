"use client";

import { REGIONES_DESTACADOS, RegionSchema, type Region } from "@cinematch/shared";
import { useCallback, useSyncExternalStore } from "react";

// País elegido para los destacados. Se guarda en el navegador y se comparte entre componentes.
const CLAVE = "cinematch-region";
const PREDETERMINADA: Region = "MX";
const oyentes = new Set<() => void>();

function leer(): Region {
  try {
    const valor = RegionSchema.safeParse(localStorage.getItem(CLAVE));
    return valor.success ? valor.data : PREDETERMINADA;
  } catch {
    return PREDETERMINADA;
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

export function useRegion() {
  const region = useSyncExternalStore(suscribir, leer, () => PREDETERMINADA);
  const cambiar = useCallback((nueva: Region) => {
    try {
      localStorage.setItem(CLAVE, nueva);
    } catch {
      // Sin almacenamiento disponible, el cambio dura solo mientras la página esté abierta.
    }
    oyentes.forEach((avisar) => avisar());
  }, []);
  return { region, cambiar, regiones: REGIONES_DESTACADOS };
}
