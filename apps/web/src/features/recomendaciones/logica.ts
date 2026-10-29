import type { AmigoRecomendable } from "@cinematch/shared";

// Amigos en dos grupos: los que coinciden con tus intereses y los demás (RN y FE-7.1).
// Dentro de cada grupo: más géneros en común primero y después por nombre de usuario.
export function agruparAmigos(amigos: AmigoRecomendable[]): {
  coinciden: AmigoRecomendable[];
  otros: AmigoRecomendable[];
} {
  const ordenar = (a: AmigoRecomendable, b: AmigoRecomendable) =>
    b.generosEnComun - a.generosEnComun || a.username.localeCompare(b.username, "es");
  return {
    coinciden: amigos.filter((amigo) => !amigo.fueraDeIntereses).sort(ordenar),
    otros: amigos.filter((amigo) => amigo.fueraDeIntereses).sort(ordenar),
  };
}

// El envío solo se habilita con un amigo elegido, y si queda fuera de intereses, con la confirmación.
export function puedeEnviar({
  amigo,
  confirmado,
  enviando,
}: {
  amigo: AmigoRecomendable | null;
  confirmado: boolean;
  enviando: boolean;
}): boolean {
  if (!amigo || enviando) return false;
  if (!amigo.seleccionable) return false;
  return !amigo.fueraDeIntereses || confirmado;
}
