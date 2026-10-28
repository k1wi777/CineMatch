import type { Metadata } from "next";
import { FormularioRegistro } from "@/features/auth/formulario-registro";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default function PaginaRegistro() {
  return <FormularioRegistro />;
}
