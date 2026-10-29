import type { Metadata } from "next";
import { PaginaInicio } from "@/features/comunidad/inicio";

export const metadata: Metadata = {
  title: "Inicio",
};

export default function Inicio() {
  return <PaginaInicio />;
}
