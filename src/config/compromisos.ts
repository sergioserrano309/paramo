/** Tipos de compromiso (as-is TIPOS). Mismos valores que el CHECK de `compromisos.tipo`. */
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

/** Atajos de fecha del formulario (as-is datequick): etiqueta y días desde hoy. */
export const ATAJOS_FECHA = [
  { etiqueta: "Hoy", dias: 0 },
  { etiqueta: "Mañana", dias: 1 },
  { etiqueta: "En 3 días", dias: 3 },
  { etiqueta: "En 1 semana", dias: 7 },
  { etiqueta: "En 2 semanas", dias: 14 },
] as const;

/** Ventana de cumplimiento y de «Hechos» visibles (días hacia atrás). */
export const DIAS_CUMPLIMIENTO = 30;
export const DIAS_HISTORIAL = 90;
