import { describe, expect, it } from "vitest";
import { agregarToast, quitarToast, type Toast } from "./toast-estado";

describe("avisos (toasts) de la web (FE-0.3)", () => {
  it("un aviso añadido se puede cerrar por su identificador", () => {
    const lista = agregarToast([], { tipo: "exito", mensaje: "Guardado" }, 1);

    expect(lista).toEqual([{ id: 1, tipo: "exito", mensaje: "Guardado" }]);
    expect(quitarToast(lista, 1)).toEqual([]);
  });

  it("como mucho se muestran cuatro avisos a la vez; los más antiguos salen primero", () => {
    let lista: Toast[] = [];
    for (let i = 1; i <= 6; i++) {
      lista = agregarToast(lista, { tipo: "info", mensaje: `Aviso ${i}` }, i);
    }

    expect(lista.map((t) => t.id)).toEqual([3, 4, 5, 6]);
  });

  it("cerrar un aviso que ya no existe no cambia la lista", () => {
    const lista = agregarToast([], { tipo: "error", mensaje: "Algo falló" }, 1);

    expect(quitarToast(lista, 99)).toEqual(lista);
  });
});
