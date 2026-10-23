/** Tipos de actividad que registra el comercial a mano (as-is ACT_TIPOS). */
export const ACT_TIPOS = [
  "Llamada",
  "Visita",
  "WhatsApp",
  "Correo",
  "Degustación",
  "Reunión",
] as const;

/** Entradas que el sistema escribe solo en el historial. */
export const ACT_ETAPA = "Etapa";
export const ACT_ESTADO = "Estado";

/** Motivos al inactivar un prospecto (as-is MOTIVOS_INACT). */
export const MOTIVOS_INACTIVO = [
  "No está interesado",
  "Cerró o cambió de negocio",
  "No responde",
  "Datos errados",
  "Duplicado",
  "Otro",
] as const;

export function isMotivoInactivo(v: string): boolean {
  return (MOTIVOS_INACTIVO as readonly string[]).includes(v);
}

export const CALIF_TXT = [
  "Sin calificar",
  "Potencial bajo",
  "Potencial medio",
  "Potencial alto",
] as const;
