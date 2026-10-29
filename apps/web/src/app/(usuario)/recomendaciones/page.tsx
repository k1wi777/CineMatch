import type { Metadata } from "next";
import { PaginaBandeja } from "@/features/recomendaciones/pagina-bandeja";

export const metadata: Metadata = {
  title: "Recomendaciones",
};

export default function PaginaRecomendaciones() {
  return <PaginaBandeja />;
}
