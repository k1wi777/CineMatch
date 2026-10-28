import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ProveedorApi } from "@/shared/api";
import { ToastProvider } from "@/shared/ui/toast";

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
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProveedorApi>
            <ToastProvider>{children}</ToastProvider>
          </ProveedorApi>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
