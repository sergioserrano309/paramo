/** Motivos al pasar a Perdido (as-is MOTIVOS en pre-arquitectura). */
export const MOTIVOS_PERDIDA = [
  "Precio",
  "Sin espacio / codificación",
  "Ya tiene proveedor",
  "No responde",
  "Condiciones de pago",
  "Otro",
] as const;

export type MotivoPerdida = (typeof MOTIVOS_PERDIDA)[number];

export function isMotivoPerdida(value: string): value is MotivoPerdida {
  return (MOTIVOS_PERDIDA as readonly string[]).includes(value);
}
