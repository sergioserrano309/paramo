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
