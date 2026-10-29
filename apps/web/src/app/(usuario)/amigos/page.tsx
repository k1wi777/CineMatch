import type { Metadata } from "next";
import { ListaAmigos } from "@/features/amigos/lista-amigos";

export const metadata: Metadata = {
  title: "Mis amigos",
};

export default function PaginaAmigos() {
  return <ListaAmigos />;
}
