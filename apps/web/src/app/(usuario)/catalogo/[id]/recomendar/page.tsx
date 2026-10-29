import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaRecomendar } from "@/features/recomendaciones/pagina-recomendar";

export const metadata: Metadata = {
  title: "Recomendar",
};

type Props = { params: Promise<{ id: string }> };

export default async function PaginaRecomendarRuta({ params }: Props) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    notFound();
  }
  return <PaginaRecomendar id={numero} />;
}
