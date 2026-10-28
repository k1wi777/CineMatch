import type { Metadata } from "next";
import { BuscarPersonas } from "@/features/usuarios/buscar-personas";

export const metadata: Metadata = {
  title: "Buscar personas",
};

export default function PaginaBuscarPersonas() {
  return <BuscarPersonas />;
}
