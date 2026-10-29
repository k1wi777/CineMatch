import type { Metadata } from "next";
import { PaginaBiblioteca } from "@/features/biblioteca/pagina-biblioteca";

export const metadata: Metadata = {
  title: "Biblioteca",
};

export default function PaginaBibliotecaRuta() {
  return <PaginaBiblioteca />;
}
