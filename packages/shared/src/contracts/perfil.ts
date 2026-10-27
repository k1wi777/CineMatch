import { z } from "zod";

// Username único sin distinguir mayúsculas (RN17). Lo usan el registro y el perfil.
export const UsernameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_]{3,20}$/, "Usa de 3 a 20 letras, números o guion bajo.");

// Quita etiquetas HTML y normaliza espacios antes de medir, igual que textoPlano en la API.
// Así una etiqueta no cuenta contra el máximo ni deja un texto vacío que pase la validación.
const quitarEtiquetas = (valor: string) =>
  valor
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

export const NombreSchema = z
  .string()
  .transform(quitarEtiquetas)
  .pipe(z.string().min(1, "Escribe tu nombre.").max(100, "No puede superar 100 caracteres."));

export const BioSchema = z
  .string()
  .transform(quitarEtiquetas)
  .pipe(z.string().max(300, "No puede superar 300 caracteres."));

// Perfil propio (BE-4.2). El correo solo lo ve su dueño; puede ser null si la cuenta se anonimizó.
export const PerfilSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  username: z.string(),
  correo: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type Perfil = z.infer<typeof PerfilSchema>;

// Avatar subido (BE-4.4): ruta pública relativa, p. ej. /uploads/avatars/12-<hex>.webp.
export const AvatarSchema = z.object({
  avatarUrl: z.string(),
});

export type Avatar = z.infer<typeof AvatarSchema>;

// Cambios parciales del perfil. Un bio vacío o null borra la biografía.
export const ActualizarPerfilSchema = z
  .object({
    nombre: NombreSchema.optional(),
    username: UsernameSchema.optional(),
    bio: BioSchema.nullable().optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "Indica al menos un dato para actualizar.",
  });

export type ActualizarPerfil = z.infer<typeof ActualizarPerfilSchema>;
