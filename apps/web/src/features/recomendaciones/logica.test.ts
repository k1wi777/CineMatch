import type { AmigoRecomendable } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import { agruparAmigos, puedeEnviar } from "./logica";

const base = (datos: Partial<AmigoRecomendable>): AmigoRecomendable => ({
  id: 1,
  username: "ana",
  avatarUrl: null,
  generosEnComun: 0,
  fueraDeIntereses: false,
  yaLaVio: false,
  yaRecomendada: false,
  seleccionable: true,
  ...datos,
});

describe("agruparAmigos", () => {
  it("separa los que coinciden con intereses y ordena por géneros en común y nombre", () => {
    const { coinciden, otros } = agruparAmigos([
      base({ id: 1, username: "zeta", generosEnComun: 1 }),
      base({ id: 2, username: "beta", generosEnComun: 3 }),
      base({ id: 3, username: "alfa", generosEnComun: 3 }),
      base({ id: 4, username: "gamma", fueraDeIntereses: true }),
    ]);
    expect(coinciden.map((amigo) => amigo.username)).toEqual(["alfa", "beta", "zeta"]);
    expect(otros.map((amigo) => amigo.username)).toEqual(["gamma"]);
  });
});

describe("puedeEnviar", () => {
  it("necesita un amigo elegido y seleccionable", () => {
    expect(puedeEnviar({ amigo: null, confirmado: false, enviando: false })).toBe(false);
    expect(
      puedeEnviar({ amigo: base({ seleccionable: false }), confirmado: false, enviando: false }),
    ).toBe(false);
    expect(puedeEnviar({ amigo: base({}), confirmado: false, enviando: false })).toBe(true);
  });

  it("fuera de intereses exige confirmación y no se envía dos veces", () => {
    const fuera = base({ fueraDeIntereses: true });
    expect(puedeEnviar({ amigo: fuera, confirmado: false, enviando: false })).toBe(false);
    expect(puedeEnviar({ amigo: fuera, confirmado: true, enviando: false })).toBe(true);
    expect(puedeEnviar({ amigo: base({}), confirmado: false, enviando: true })).toBe(false);
  });
});
