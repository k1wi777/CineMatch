import type { Metadata } from "next";
import { Solicitudes } from "@/features/amigos/solicitudes";

export const metadata: Metadata = {
  title: "Solicitudes",
};

export default function PaginaSolicitudes() {
  return <Solicitudes />;
}
