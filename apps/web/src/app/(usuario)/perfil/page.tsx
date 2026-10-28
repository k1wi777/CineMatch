import type { Metadata } from "next";
import { PaginaPerfil } from "@/features/perfil/pagina-perfil";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export default function PaginaMiPerfil() {
  return <PaginaPerfil />;
}
