import { getRequestConfig } from "next-intl/server";

// La aplicación va solo en español: sin prefijo de idioma en las URLs.
export const LOCALE = "es" as const;

export default getRequestConfig(async () => ({
  locale: LOCALE,
  messages: (await import("../../messages/es.json")).default,
}));
