import type { RecommendationAction, RecommendationStatus } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  transition,
} from "../../src/modules/recomendaciones/recommendation-state.js";

const ESTADOS: RecommendationStatus[] = [
  "enviada",
  "abierta",
  "aceptada",
  "descartada",
  "completada",
];
const ACCIONES: RecommendationAction[] = ["OPEN", "ACCEPT", "DISCARD", "COMPLETE"];

// Resultado esperado de cada par (estado, acción). "ERR" = transición inválida.
const ESPERADO: Record<RecommendationStatus, Record<RecommendationAction, string>> = {
  enviada: { OPEN: "abierta", ACCEPT: "aceptada", DISCARD: "descartada", COMPLETE: "completada" },
  abierta: { OPEN: "abierta", ACCEPT: "aceptada", DISCARD: "descartada", COMPLETE: "completada" },
  aceptada: { OPEN: "aceptada", ACCEPT: "aceptada", DISCARD: "ERR", COMPLETE: "completada" },
  descartada: { OPEN: "ERR", ACCEPT: "ERR", DISCARD: "descartada", COMPLETE: "ERR" },
  completada: { OPEN: "completada", ACCEPT: "completada", DISCARD: "ERR", COMPLETE: "completada" },
};

describe("máquina de estados de recomendaciones (BE-10.1)", () => {
  for (const estado of ESTADOS) {
    for (const accion of ACCIONES) {
      const esperado = ESPERADO[estado][accion];
      it(`${estado} + ${accion} → ${esperado === "ERR" ? "transición inválida" : esperado}`, () => {
        if (esperado === "ERR") {
          expect(() => transition(estado, accion)).toThrow(InvalidTransitionError);
          return;
        }
        const resultado = transition(estado, accion);
        expect(resultado.siguiente).toBe(esperado);
        expect(resultado.cambia).toBe(esperado !== estado);
      });
    }
  }

  it("cada transición que cambia estado indica la fecha que debe fijar", () => {
    expect(transition("enviada", "OPEN").campoFecha).toBe("fecha_apertura");
    expect(transition("abierta", "ACCEPT").campoFecha).toBe("fecha_respuesta");
    expect(transition("abierta", "DISCARD").campoFecha).toBe("fecha_respuesta");
    expect(transition("aceptada", "COMPLETE").campoFecha).toBe("fecha_completado");
  });

  it("las acciones que no cambian nada no piden fecha", () => {
    expect(transition("aceptada", "ACCEPT").campoFecha).toBeNull();
    expect(transition("completada", "COMPLETE").campoFecha).toBeNull();
  });

  it("una transición inválida es un 409 con código INVALID_TRANSITION", () => {
    try {
      transition("descartada", "COMPLETE");
      throw new Error("debía lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      expect((err as InvalidTransitionError).status).toBe(409);
      expect((err as InvalidTransitionError).code).toBe("INVALID_TRANSITION");
    }
  });
});
