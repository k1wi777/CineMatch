import type { Metadata } from "next";
import { PanelModeracion } from "@/features/admin/moderacion";

export const metadata: Metadata = {
  title: "Moderación",
};

export default function PaginaModeracion() {
  return <PanelModeracion />;
}
