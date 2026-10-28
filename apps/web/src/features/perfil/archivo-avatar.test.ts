import { describe, expect, it } from "vitest";
import { errorArchivoAvatar, TAMANO_MAXIMO_AVATAR } from "./archivo-avatar";

describe("errorArchivoAvatar", () => {
  it("acepta JPEG, PNG y WebP dentro del tamaño", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(errorArchivoAvatar({ type, size: 1000 })).toBeNull();
    }
  });

  it("rechaza otros tipos de archivo", () => {
    expect(errorArchivoAvatar({ type: "image/gif", size: 1000 })).toBe("tipo");
    expect(errorArchivoAvatar({ type: "application/pdf", size: 1000 })).toBe("tipo");
  });

  it("rechaza archivos de más de 2 MB y acepta exactamente 2 MB", () => {
    expect(errorArchivoAvatar({ type: "image/png", size: TAMANO_MAXIMO_AVATAR })).toBeNull();
    expect(errorArchivoAvatar({ type: "image/png", size: TAMANO_MAXIMO_AVATAR + 1 })).toBe(
      "tamano",
    );
  });
});
