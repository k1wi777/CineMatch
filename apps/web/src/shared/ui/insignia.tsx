// Insignia de estado. El texto siempre va visible; el color solo acompaña, nunca es el único indicador.
export type TonoInsignia = "neutro" | "luz" | "estrella" | "exito" | "error";

const TONOS: Record<TonoInsignia, string> = {
  neutro: "border-papel/30 text-papel",
  luz: "border-luz text-luz",
  estrella: "border-estrella text-estrella",
  exito: "border-musgo text-musgo",
  error: "border-brasa text-brasa",
};

export function Insignia({ texto, tono = "neutro" }: { texto: string; tono?: TonoInsignia }) {
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs ${TONOS[tono]}`}>
      {texto}
    </span>
  );
}
