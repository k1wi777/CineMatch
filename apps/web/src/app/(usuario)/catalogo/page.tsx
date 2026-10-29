import type { Metadata } from "next";
import { PaginaCatalogo } from "@/features/catalogo/pagina-catalogo";
import { filtrosDesdeParams } from "@/features/catalogo/filtros";

export const metadata: Metadata = {
  title: "Catálogo",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Los filtros llegan en la URL: el servidor los interpreta y la pantalla los usa tal cual.
export default async function PaginaCatalogoRuta({ searchParams }: Props) {
  const filtros = filtrosDesdeParams(await searchParams);
  return <PaginaCatalogo filtros={filtros} />;
}
