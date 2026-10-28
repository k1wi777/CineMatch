import type { Metadata } from "next";
import { PaginaMisDatos } from "@/features/cuenta/pagina-mis-datos";

export const metadata: Metadata = {
  title: "Mis datos",
};

export default function PaginaMisDatosRuta() {
  return <PaginaMisDatos />;
}
