import { AppError } from "../../lib/errors.js";

// Mismo mensaje para correo inexistente, usuario eliminado y contraseña errónea: no revela qué cuentas existen.
export class CredencialesInvalidasError extends AppError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
  }
}

export class CuentaBloqueadaError extends AppError {
  constructor() {
    super(423, "ACCOUNT_LOCKED", "La cuenta está bloqueada temporalmente. Inténtalo más tarde.");
  }
}
