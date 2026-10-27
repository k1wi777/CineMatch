import { ActualizarPerfilSchema, BioSchema, NombreSchema, UsernameSchema } from "@cinematch/shared";
import { describe, expect, it } from "vitest";

describe("contratos del perfil (BE-4.2)", () => {
  it("el username acepta 3 a 20 caracteres permitidos y rechaza el resto", () => {
    expect(UsernameSchema.safeParse("abc").success).toBe(true);
    expect(UsernameSchema.safeParse("a".repeat(20)).success).toBe(true);
    expect(UsernameSchema.safeParse("ab").success).toBe(false);
    expect(UsernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(UsernameSchema.safeParse("con espacio").success).toBe(false);
  });

  it("el nombre cuenta sin etiquetas HTML y no puede quedar vacío", () => {
    expect(NombreSchema.parse("  Ana   Ruiz ")).toBe("Ana Ruiz");
    expect(NombreSchema.safeParse("<i></i>").success).toBe(false);
    expect(NombreSchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("la bio no cuenta las etiquetas HTML contra los 300 caracteres", () => {
    const conEtiquetas = `<b>${"x".repeat(300)}</b>`;

    expect(BioSchema.parse(conEtiquetas)).toBe("x".repeat(300));
    expect(BioSchema.safeParse("x".repeat(301)).success).toBe(false);
  });

  it("una actualización sin campos no es válida", () => {
    expect(ActualizarPerfilSchema.safeParse({}).success).toBe(false);
    expect(ActualizarPerfilSchema.safeParse({ bio: null }).success).toBe(true);
  });
});
