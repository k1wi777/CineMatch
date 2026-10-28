// Chip de etiqueta. Con onQuitar muestra un botón con nombre accesible para quitarla.
export function Chip({ texto, onQuitar }: { texto: string; onQuitar?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm bg-telon px-2.5 py-1 text-sm text-papel">
      {texto}
      {onQuitar ? (
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar ${texto}`}
          className="text-niebla hover:text-papel"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
