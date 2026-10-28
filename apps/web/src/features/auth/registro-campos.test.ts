import { PasswordSchema } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import { MINIMO_GENEROS, REGISTRO_FORMULARIO, requisitosContrasena } from "./registro-campos";

const valido = {
  nombre: "Ana",
  username: "ana_99",
  correo: "ana@demo.cinematch.local",
  contrasena: "Demo1234",
  aceptaDatos: true,
  generoIds: [1, 2, 3],
};

describe("requisitosContrasena", () => {
  it("marca cada requisito según lo que cumple", () => {
    expect(requisitosContrasena("abc").map((r) => r.cumple)).toEqual([false, true, false]);
    expect(requisitosContrasena("Demo1234").every((r) => r.cumple)).toBe(true);
  });

  it("coincide con la política de PasswordSchema", () => {
    for (const valor of ["abc", "12345678", "abcdefgh", "Demo1234", "a1b2c3d4"]) {
      const cumpleTodos = requisitosContrasena(valor).every((r) => r.cumple);
      expect(PasswordSchema.safeParse(valor).success).toBe(cumpleTodos);
    }
  });
});

describe("REGISTRO_FORMULARIO", () => {
  it("acepta un registro completo", () => {
    expect(REGISTRO_FORMULARIO.safeParse(valido).success).toBe(true);
  });

  it("exige la autorización de datos", () => {
    expect(REGISTRO_FORMULARIO.safeParse({ ...valido, aceptaDatos: false }).success).toBe(false);
  });

  it("exige al menos tres géneros", () => {
    expect(MINIMO_GENEROS).toBe(3);
    expect(REGISTRO_FORMULARIO.safeParse({ ...valido, generoIds: [1, 2] }).success).toBe(false);
  });

  it("valida el formato de username", () => {
    expect(REGISTRO_FORMULARIO.safeParse({ ...valido, username: "ab" }).success).toBe(false);
    expect(REGISTRO_FORMULARIO.safeParse({ ...valido, username: "con espacio" }).success).toBe(
      false,
    );
  });
});
