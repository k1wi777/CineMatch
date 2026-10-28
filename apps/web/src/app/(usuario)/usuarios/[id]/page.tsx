import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaPerfilPublico } from "@/features/usuarios/pagina-perfil-publico";

export const metadata: Metadata = {
  title: "Perfil",
};

type Props = { params: Promise<{ id: string }> };

export default async function PaginaUsuario({ params }: Props) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    notFound();
  }
  return <PaginaPerfilPublico id={numero} />;
}
