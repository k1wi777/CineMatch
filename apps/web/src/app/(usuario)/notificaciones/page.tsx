import type { Metadata } from "next";
import { CentroNotificaciones } from "@/features/notificaciones/pagina-notificaciones";

export const metadata: Metadata = {
  title: "Notificaciones",
};

export default function PaginaNotificaciones() {
  return <CentroNotificaciones />;
}
