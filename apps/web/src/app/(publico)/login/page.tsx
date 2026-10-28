import { getTranslations } from "next-intl/server";

type Props = { searchParams: Promise<{ aviso?: string }> };

// Login: por ahora solo muestra los avisos que llegan de otras pantallas. El formulario llega en FE-1.2.
export default async function PaginaLogin({ searchParams }: Props) {
  const { aviso } = await searchParams;
  const t = await getTranslations("login");
  const mensaje =
    aviso === "registro-ok"
      ? t("registroOk")
      : aviso === "sesion-expirada"
        ? t("sesionExpirada")
        : null;

  return (
    <section className="space-y-3">
      <h1 className="font-display text-3xl">{t("titulo")}</h1>
      {mensaje ? (
        <p role="status" className="text-sm text-musgo">
          {mensaje}
        </p>
      ) : null}
      <p className="text-niebla">{t("pendiente")}</p>
    </section>
  );
}
