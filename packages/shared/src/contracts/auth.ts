import { z } from "zod";

// Política de contraseñas (sección 2): mínimo 8 caracteres, al menos una letra y un número.
export const PasswordSchema = z
  .string()
  .min(8, "Debe tener al menos 8 caracteres.")
  .max(256, "No puede superar 256 caracteres.")
  .regex(/[A-Za-z]/, "Debe incluir al menos una letra.")
  .regex(/\d/, "Debe incluir al menos un número.");

// Credenciales de inicio de sesión. La política se valida al registrarse (y al restablecer), no al entrar.
export const LoginSchema = z.object({
  correo: z.email().max(255),
  contrasena: z.string().min(1).max(256),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

// Usuario de la sesión actual: lo que devuelven el login y GET /auth/me.
export const UsuarioSesionSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  nombre: z.string(),
  rol: z.enum(["usuario", "administrador"]),
});

export type UsuarioSesion = z.infer<typeof UsuarioSesionSchema>;

// Registro de cuenta (BE-3.1). Crea el usuario y sus intereses; no inicia sesión.
export const RegistroSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "Usa de 3 a 20 letras, números o guion bajo."),
  correo: z.email().max(255),
  contrasena: PasswordSchema,
  aceptaDatos: z.literal(true, { message: "Debes aceptar el tratamiento de tus datos." }),
  generoIds: z
    .array(z.number().int().positive())
    .min(3, "Elige al menos 3 géneros de interés.")
    .refine((ids) => new Set(ids).size === ids.length, "No repitas géneros."),
});

export type Registro = z.infer<typeof RegistroSchema>;

export const RegistroRespuestaSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  nombre: z.string(),
});

export type RegistroRespuesta = z.infer<typeof RegistroRespuestaSchema>;

// Recuperación de contraseña (BE-3.4): pedir el enlace y usarlo.
export const SolicitarRecuperacionSchema = z.object({
  correo: z.email().max(255),
});

export type SolicitarRecuperacion = z.infer<typeof SolicitarRecuperacionSchema>;

export const RestablecerContrasenaSchema = z.object({
  token: z.string().min(1).max(200),
  contrasena: PasswordSchema,
});

export type RestablecerContrasena = z.infer<typeof RestablecerContrasenaSchema>;
