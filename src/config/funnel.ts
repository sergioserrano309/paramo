/**
 * Constantes del funnel alineadas al as-is (pre-arquitectura).
 * Colores de columna: tokens --paramo-stage-* / leaf / rasp en paramo-theme.css.
 */

/** Días sin contacto para marcar tarjeta como stale (as-is STALE_DAYS). */
export const STALE_DAYS = 14;

/** Color de acento del encabezado de columna por código de etapa. */
export const ETAPA_COL_COLOR: Record<string, string> = {
  prospecto: "var(--paramo-stage-1)",
  contactado: "var(--paramo-stage-2)",
  muestra: "var(--paramo-stage-3)",
  propuesta: "var(--paramo-stage-4)",
  negociacion: "var(--paramo-stage-5)",
  ganado: "var(--paramo-leaf)",
  perdido: "var(--paramo-rasp)",
};
