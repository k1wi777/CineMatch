import type { Metadata } from "next";
import { FormularioRecuperar } from "@/features/auth/formulario-recuperar";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default function PaginaRecuperar() {
  return <FormularioRecuperar />;
}
