import { getTranslations } from "next-intl/server";
import { FormularioLogin } from "@/features/auth/formulario-login";

type Props = { searchParams: Promise<{ aviso?: string; siguiente?: string }> };

export async function generateMetadata() {
  return { title: "Iniciar sesión" };
}

// Login: muestra los avisos que llegan de otras pantallas y el formulario.
export default async function PaginaLogin({ searchParams }: Props) {
  const { aviso, siguiente } = await searchParams;
  const t = await getTranslations("login");
  const mensaje =
    aviso === "registro-ok"
      ? t("registroOk")
      : aviso === "sesion-expirada"
        ? t("sesionExpirada")
        : aviso === "contrasena-restablecida"
          ? t("contrasenaRestablecida")
          : aviso === "cuenta-eliminada"
            ? t("cuentaEliminada")
            : null;

  return (
    <div className="space-y-6">
      {mensaje ? (
        <p role="status" className="text-sm text-musgo">
          {mensaje}
        </p>
      ) : null}
      <FormularioLogin siguiente={siguiente} />
    </div>
  );
}
