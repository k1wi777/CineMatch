import argon2 from "argon2";

// Hash de contraseñas con argon2id (README y issue #24). BE-3.1 reutiliza estas funciones en el registro.
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
