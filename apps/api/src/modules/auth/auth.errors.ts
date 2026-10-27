import { AppError } from "../../lib/errors.js";

// Mismo mensaje para correo inexistente, usuario eliminado y contraseña errónea: no revela qué cuentas existen.
export class CredencialesInvalidasError extends AppError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
  }
}

// Enlace de recuperación inválido, vencido o ya usado. Cada caso tiene su código y su mensaje.
export class TokenRecuperacionInvalidoError extends AppError {
  constructor() {
    super(400, "RESET_TOKEN_INVALID", "El enlace no es válido. Pide uno nuevo.");
  }
}

export class TokenRecuperacionVencidoError extends AppError {
  constructor() {
    super(400, "RESET_TOKEN_EXPIRED", "El enlace venció. Pide uno nuevo.");
  }
}

export class TokenRecuperacionUsadoError extends AppError {
  constructor() {
    super(400, "RESET_TOKEN_USED", "Este enlace ya se usó. Pide uno nuevo si lo necesitas.");
  }
}

export class CuentaBloqueadaError extends AppError {
  constructor() {
    super(423, "ACCOUNT_LOCKED", "La cuenta está bloqueada temporalmente. Inténtalo más tarde.");
  }
}
