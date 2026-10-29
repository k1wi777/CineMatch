import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaFicha } from "@/features/catalogo/pagina-ficha";

export const metadata: Metadata = {
  title: "Título",
};

type Props = { params: Promise<{ id: string }> };

export default async function PaginaTitulo({ params }: Props) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    notFound();
  }
  return <PaginaFicha id={numero} />;
}
