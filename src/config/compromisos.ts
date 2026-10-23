/** Tipos de compromiso del as-is (TIPOS) y del modal «Nuevo compromiso». */
export const TIPOS_COMPROMISO = [
  "Llamada",
  "Visita",
  "WhatsApp",
  "Correo",
  "Enviar muestra",
  "Degustación",
  "Enviar cotización",
  "Seguimiento",
  "Cobro",
  "Otro",
] as const;

export type TipoCompromiso = (typeof TIPOS_COMPROMISO)[number];

export function isTipoCompromiso(value: string): value is TipoCompromiso {
  return (TIPOS_COMPROMISO as readonly string[]).includes(value);
}

/** Atajos de fecha del modal (as-is datequick). El número son días desde hoy. */
export const ATAJOS_FECHA_COMPROMISO = [
  ["Hoy", 0],
  ["Mañana", 1],
  ["En 3 días", 3],
  ["En 1 semana", 7],
  ["En 2 semanas", 14],
] as const;
