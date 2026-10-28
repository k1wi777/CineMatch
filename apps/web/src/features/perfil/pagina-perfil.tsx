"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { mensajeDeError } from "@/shared/api";
import { Avatar } from "@/shared/ui/avatar";
import { EstadoError } from "@/shared/ui/estados";
import { Skeleton } from "@/shared/ui/skeleton";
import { SeccionAvatar } from "./seccion-avatar";
import { SeccionContrasena } from "./seccion-contrasena";
import { SeccionDatos } from "./seccion-datos";
import { SeccionIntereses } from "./seccion-intereses";
import { usePerfil } from "./perfil";

// Mi perfil (FE-2.1). Cada sección guarda por separado y muestra su propio resultado.
export function PaginaPerfil() {
  const t = useTranslations("perfil");
  const perfil = usePerfil();

  if (perfil.isPending) {
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (perfil.isError) {
    return (
      <EstadoError
        mensaje={mensajeDeError(perfil.error)}
        onReintentar={() => void perfil.refetch()}
      />
    );
  }

  const datos = perfil.data;
  return (
    <div className="space-y-12">
      <header className="flex items-center gap-4">
        <Avatar nombre={datos.nombre} url={datos.avatarUrl} tamano={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl">{datos.nombre}</h1>
          <p className="truncate text-niebla">@{datos.username}</p>
        </div>
        <Link
          href="/amigos/buscar"
          className="shrink-0 text-sm text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("buscarPersonas")}
        </Link>
      </header>

      <SeccionAvatar perfil={datos} />
      <SeccionDatos perfil={datos} />
      <SeccionIntereses />
      <SeccionContrasena />

      <p className="text-sm">
        <Link
          href="/mis-datos"
          className="text-niebla underline underline-offset-4 hover:text-papel"
        >
          {t("misDatos")}
        </Link>
      </p>
    </div>
  );
}
