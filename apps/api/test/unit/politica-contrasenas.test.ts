import { PasswordSchema, RegistroSchema } from "@cinematch/shared";
import { describe, expect, it } from "vitest";
import { readAdminSeed } from "../../seeds/config.js";

describe("política de contraseñas y registro (BE-3.1)", () => {
  it("acepta 8 o más caracteres con al menos una letra y un número", () => {
    expect(PasswordSchema.safeParse("Clave1234").success).toBe(true);
    expect(PasswordSchema.safeParse("abcdefg1").success).toBe(true);
  });

  it("rechaza menos de 8 caracteres, y contraseñas sin letra o sin número", () => {
    expect(PasswordSchema.safeParse("Abc123").success).toBe(false);
    expect(PasswordSchema.safeParse("solo-letras-x").success).toBe(false);
    expect(PasswordSchema.safeParse("123456789").success).toBe(false);
  });

  it("el registro exige aceptaDatos verdadero y al menos 3 géneros distintos", () => {
    const base = {
      nombre: "Ana",
      username: "ana_ok",
      correo: "ana@cinematch.test",
      contrasena: "Clave1234",
      aceptaDatos: true,
      generoIds: [1, 2, 3],
    };

    expect(RegistroSchema.safeParse(base).success).toBe(true);
    expect(RegistroSchema.safeParse({ ...base, aceptaDatos: false }).success).toBe(false);
    expect(RegistroSchema.safeParse({ ...base, generoIds: [1, 2] }).success).toBe(false);
    expect(RegistroSchema.safeParse({ ...base, generoIds: [1, 1, 2] }).success).toBe(false);
  });

  it("el seed del administrador rechaza una ADMIN_PASSWORD que no cumple la política", () => {
    const env = {
      ADMIN_EMAIL: "admin@cinematch.test",
      ADMIN_USERNAME: "admin_x",
      ADMIN_PASSWORD: "corta",
    };

    expect(() => readAdminSeed(env)).toThrow("ADMIN_PASSWORD no cumple la política de contraseñas");
  });

  it("el seed acepta una ADMIN_PASSWORD que cumple la política", () => {
    const env = {
      ADMIN_EMAIL: "admin@cinematch.test",
      ADMIN_USERNAME: "admin_x",
      ADMIN_PASSWORD: "Admin1234",
    };

    expect(readAdminSeed(env)?.username).toBe("admin_x");
  });
});
