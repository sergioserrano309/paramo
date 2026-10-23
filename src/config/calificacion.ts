/** Textos de calificación 0–3 (as-is CALIF_TXT). */
export const CALIF_TXT = [
  "Sin calificar",
  "Potencial bajo",
  "Potencial medio",
  "Potencial alto",
] as const;

export function stars3(n: number): string {
  const v = Math.max(0, Math.min(3, n || 0));
  return "★".repeat(v) + "☆".repeat(3 - v);
}
