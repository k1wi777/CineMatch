import type { Notificacion } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import { hrefNotificacion, textoNotificacion } from "./textos";

const base = (datos: Partial<Notificacion>): Notificacion => ({
  id: 1,
  tipo: "recomendacion_recibida",
  fechaCreacion: "2026-01-01T00:00:00.000Z",
  leida: false,
  fechaLectura: null,
  origen: { username: "ana", avatarUrl: null },
  target: { tipo: "recomendacion", id: 7 },
  ...datos,
});

describe("textoNotificacion", () => {
  it("cada tipo tiene su texto con el origen", () => {
    expect(textoNotificacion(base({ tipo: "recomendacion_recibida" }))).toBe(
      "@ana te recomendó un título.",
    );
    expect(textoNotificacion(base({ tipo: "solicitud_amistad" }))).toBe(
      "@ana te envió una solicitud de amistad.",
    );
    expect(textoNotificacion(base({ tipo: "amistad_aceptada" }))).toBe(
      "@ana aceptó tu solicitud de amistad.",
    );
    expect(textoNotificacion(base({ tipo: "recomendacion_completada" }))).toBe(
      "@ana completó tu recomendación.",
    );
  });

  it("sin origen usa un texto genérico", () => {
    expect(textoNotificacion(base({ origen: null, tipo: "recomendacion_recibida" }))).toBe(
      "Tienes una recomendación nueva.",
    );
  });

  it("la reseña oculta no nombra a nadie", () => {
    expect(
      textoNotificacion(
        base({ tipo: "resena_oculta", origen: null, target: { tipo: "resena", id: 3 } }),
      ),
    ).toBe("La moderación ocultó una de tus reseñas.");
  });
});

describe("hrefNotificacion", () => {
  it("lleva al elemento relacionado", () => {
    expect(hrefNotificacion(base({}))).toBe("/recomendaciones/7");
    expect(
      hrefNotificacion(base({ tipo: "solicitud_amistad", target: { tipo: "amistad", id: 2 } })),
    ).toBe("/amigos/solicitudes");
    expect(
      hrefNotificacion(base({ tipo: "amistad_aceptada", target: { tipo: "amistad", id: 2 } })),
    ).toBe("/amigos");
    expect(
      hrefNotificacion(base({ tipo: "resena_oculta", target: { tipo: "resena", id: 3 } })),
    ).toBe("/perfil/resenas");
  });
});
