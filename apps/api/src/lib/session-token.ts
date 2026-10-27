import { createHash, randomBytes } from "node:crypto";

// Token de sesión aleatorio de 32 bytes. Solo viaja en la cookie; en base de datos se guarda su hash.
export function generarTokenDeSesion(): string {
  return randomBytes(32).toString("base64url");
}

// Hash SHA-256 en hexadecimal (64 caracteres), que es el id de la fila `sesion`.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
