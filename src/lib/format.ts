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

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/** Suma días a una fecha YYYY-MM-DD (mediodía local, como addDays del as-is). */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fecha corta dd/mm/yyyy (drawer) a partir de ISO o YYYY-MM-DD. */
export function formatDateShort(isoOrDate: string): string {
  const d = isoOrDate.includes("T")
    ? localDayBogota(isoOrDate)
    : isoOrDate;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

/** Fecha compacta del as-is fDate: «22 oct» / «22 oct 25». */
export function formatDateCompact(ymd: string): string {
  const [y, m, day] = ymd.split("-");
  if (!y || !m || !day) return ymd;
  const mes = MES_CORTO[Number(m) - 1] ?? m;
  const yearNow = todayBogota().slice(0, 4);
  const suffix = y !== yearNow ? ` ${y.slice(2)}` : "";
  return `${Number(day)} ${mes}${suffix}`;
}

/** Etiqueta de compromiso: Hoy / Mañana / Ayer / fDate (as-is dateTxt). */
export function formatCompromisoFecha(fecha: string, hoy = todayBogota()): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === addDaysYmd(hoy, 1)) return "Mañana";
  if (fecha === addDaysYmd(hoy, -1)) return "Ayer";
  return formatDateCompact(fecha);
}

/** Clase semántica de fecha de compromiso (as-is dateClass). */
export function compromisoFechaTone(
  fecha: string,
  hoy = todayBogota(),
): "late" | "today" | "ok" {
  if (fecha < hoy) return "late";
  if (fecha === hoy) return "today";
  return "ok";
}

/** Último contacto relativo: hoy / hace N d (as-is listado). */
export function formatUltimoContacto(
  ultimoContacto: string | null,
  creadoEn: string,
  hoy = todayBogota(),
): { label: string; stale: boolean; days: number | null } {
  const lt = ultimoContacto || localDayBogota(creadoEn);
  if (!lt) return { label: "—", stale: false, days: null };
  const dd = daysBetween(lt, hoy);
  const label = dd === 0 ? "hoy" : `hace ${dd} d`;
  return { label, stale: false, days: dd };
}
