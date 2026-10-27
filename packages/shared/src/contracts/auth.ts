import { z } from "zod";

// Credenciales de inicio de sesión. La política de contraseñas se valida al registrarse (BE-3.1), no al entrar.
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
