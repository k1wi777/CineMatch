import type { Metadata } from "next";
import { MisResenas } from "@/features/resenas/mis-resenas";

export const metadata: Metadata = {
  title: "Mis reseñas",
};

export default function PaginaMisResenas() {
  return <MisResenas />;
}
