import type { Metadata } from "next";
import { FormularioRestablecer } from "@/features/auth/formulario-restablecer";

// El enlace lleva el token en la URL: no se envía como referrer a otros sitios.
export const metadata: Metadata = {
  title: "Nueva contraseña",
  referrer: "no-referrer",
};

type Props = { searchParams: Promise<{ token?: string }> };

export default async function PaginaRestablecer({ searchParams }: Props) {
  const { token } = await searchParams;
  return <FormularioRestablecer token={token} />;
}
