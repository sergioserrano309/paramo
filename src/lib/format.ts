/** Formato corto de montos del as-is (fmtM). Locale es-CO. */
export function formatMoneyShort(n: number): string {
  const value = n || 0;
  const a = Math.abs(value);
  if (a >= 1e9) {
    return (
      "$" +
      (value / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 }) +
      " MM"
    );
  }
  if (a >= 1e6) {
    return (
      "$" +
      (value / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) +
      " M"
    );
  }
  if (a >= 1e3) {
    return (
      "$" + Math.round(value / 1e3).toLocaleString("es-CO") + " mil"
    );
  }
  return "$" + Math.round(value);
}

/** Fecha calendario America/Bogota (YYYY-MM-DD), como today() del as-is. */
export function todayBogota(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}

/** Día local Bogotá a partir de un ISO/timestamptz. */
export function localDayBogota(isoOrDate: string): string {
  return new Date(isoOrDate).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}

/** Diferencia en días entre dos fechas YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
