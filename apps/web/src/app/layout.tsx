import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CineMatch",
    template: "%s · CineMatch",
  },
  description: "Reseñas, calificaciones y recomendaciones de películas y series entre amigos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
