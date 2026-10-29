import { useTranslations } from "next-intl";
import { paginasTotales } from "./paginacion-logica";

// Anterior y Siguiente con el número de página. Se usa cuando la paginación vive en estado, no en la URL.
export function PaginacionBotones({
  pagina,
  total,
  tamano,
  onCambio,
}: {
  pagina: number;
  total: number;
  tamano: number;
  onCambio: (pagina: number) => void;
}) {
  const t = useTranslations("comun.paginacion");
  const ultima = paginasTotales(total, tamano);
  if (ultima <= 1) return null;
  return (
    <nav aria-label={t("etiqueta")} className="flex items-center justify-center gap-4 text-sm">
      <button
        type="button"
        onClick={() => onCambio(Math.max(1, pagina - 1))}
        disabled={pagina <= 1}
        className="text-niebla hover:text-papel disabled:opacity-30"
      >
        {t("anterior")}
      </button>
      <span>{t("pagina", { actual: pagina, total: ultima })}</span>
      <button
        type="button"
        onClick={() => onCambio(Math.min(ultima, pagina + 1))}
        disabled={pagina >= ultima}
        className="text-niebla hover:text-papel disabled:opacity-30"
      >
        {t("siguiente")}
      </button>
    </nav>
  );
}
