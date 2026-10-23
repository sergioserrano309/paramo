/** Minúsculas sin tildes ni espacios en los bordes (as-is norm). */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Clave para cruzar ventas con el catálogo (as-is pkey): sin tildes, espacios, guiones,
 * guiones bajos ni puntos. «Piña Bites 28g» y «pina-bites 28 g» comparten clave.
 */
export function pkey(s: unknown): string {
  return norm(s).replace(/[\s\-_.]/g, "");
}
