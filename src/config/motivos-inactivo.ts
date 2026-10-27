/** Motivos al inactivar un prospecto (as-is MOTIVOS_INACT). No es la pérdida del funnel. */
export const MOTIVOS_INACTIVO = [
  "No está interesado",
  "Cerró o cambió de negocio",
  "No responde",
  "Datos errados",
  "Duplicado",
  "Otro",
] as const;

export type MotivoInactivo = (typeof MOTIVOS_INACTIVO)[number];

export function isMotivoInactivo(value: string): value is MotivoInactivo {
  return (MOTIVOS_INACTIVO as readonly string[]).includes(value);
}
