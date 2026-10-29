import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDetalleRecomendacion } from "@/features/recomendaciones/pagina-detalle";

export const metadata: Metadata = {
  title: "Recomendación",
};

type Props = { params: Promise<{ id: string }> };

export default async function PaginaRecomendacion({ params }: Props) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    notFound();
  }
  return <PaginaDetalleRecomendacion id={numero} />;
}
