import type { Metadata } from "next";
import { PanelSincronizacion } from "@/features/admin/sincronizacion";

export const metadata: Metadata = {
  title: "Catálogo (administración)",
};

export default function PaginaCatalogoAdmin() {
  return <PanelSincronizacion />;
}
