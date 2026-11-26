import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ProveedorApi } from "@/shared/api";
import { Pie } from "@/shared/layouts/pie";
import { ToastProvider } from "@/shared/ui/toast";

// Una sola familia para textos y títulos (estilo plataforma de streaming). Se carga con next/font: sin red externa en runtime.
const fuente = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CineMatch",
    template: "%s · CineMatch",
  },
  description: "Reseñas, calificaciones y recomendaciones de películas y series entre amigos.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={fuente.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProveedorApi>
            <ToastProvider>
              {children}
              <Pie />
            </ToastProvider>
          </ProveedorApi>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
