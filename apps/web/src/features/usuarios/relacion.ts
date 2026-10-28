import type { RelacionUsuario } from "@cinematch/shared";

// Acción principal según la relación con la sesión. Ver el perfil siempre está disponible aparte.
export type AccionRelacion = "agregar" | "cancelar" | "aceptar";

export function accionesDeRelacion(relacion: RelacionUsuario): AccionRelacion[] {
  switch (relacion) {
    case "ninguna":
      return ["agregar"];
    case "pendienteEnviada":
      return ["cancelar"];
    case "pendienteRecibida":
      return ["aceptar"];
    case "amigos":
      return [];
  }
}
