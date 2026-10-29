import type { Metadata } from "next";
import { PaginaComunidad } from "@/features/comunidad/pagina-comunidad";

export const metadata: Metadata = {
  title: "Comunidad",
};

export default function PaginaComunidadRuta() {
  return <PaginaComunidad />;
}
