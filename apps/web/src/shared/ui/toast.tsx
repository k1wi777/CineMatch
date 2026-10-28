"use client";

import { agregarToast, quitarToast, type TipoToast, type Toast } from "./toast-estado";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ContextoToast = {
  mostrar: (tipo: TipoToast, mensaje: string) => void;
  cerrar: (id: number) => void;
};

const Contexto = createContext<ContextoToast | null>(null);
const DURACION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  // Referencia: dos avisos seguidos reciben identificadores distintos aunque el render aún no haya llegado.
  const siguiente = useRef(1);

  const cerrar = useCallback((id: number) => setLista((actual) => quitarToast(actual, id)), []);

  const mostrar = useCallback(
    (tipo: TipoToast, mensaje: string) => {
      const id = siguiente.current;
      siguiente.current += 1;
      setLista((actual) => agregarToast(actual, { tipo, mensaje }, id));
      window.setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );

  const valor = useMemo(() => ({ mostrar, cerrar }), [mostrar, cerrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {lista.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-sm bg-telon px-4 py-3 text-sm shadow-foco"
          >
            <span
              className={
                toast.tipo === "error"
                  ? "text-brasa"
                  : toast.tipo === "exito"
                    ? "text-musgo"
                    : "text-luz"
              }
            >
              {toast.mensaje}
            </span>
            <button
              type="button"
              onClick={() => cerrar(toast.id)}
              className="ml-auto text-niebla hover:text-papel"
              aria-label="Cerrar aviso"
            >
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast(): ContextoToast {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return contexto;
}
