const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** «sep 26» (as-is mLabel). */
export function mesCorto(m: string): string {
  const [y, mm] = m.split("-");
  return `${MES_CORTO[Number(mm) - 1] ?? mm} ${y.slice(2)}`;
}

/** «septiembre 2026» (as-is mLong). */
export function mesLargo(m: string): string {
  const [y, mm] = m.split("-");
  return `${MES_LARGO[Number(mm) - 1] ?? mm} ${y}`;
}

export type Periodo = "12m" | string; // "12m" | "AAAA" | "AAAA-MM"

export function esPeriodoValido(p: string): boolean {
  return p === "12m" || /^\d{4}$/.test(p) || /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function ultimoDia(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(d).padStart(2, "0")}`;
}

/**
 * Rango de fechas de un período (as-is vVentas): «12m» son los últimos 12 meses
 * *cargados*, no los últimos 12 calendario. Devuelve null si no hay meses cargados.
 */
export function rangoDePeriodo(
  periodo: Periodo,
  mesesCargados: string[],
): { desde: string; hasta: string; meses: string[] } | null {
  const ms = [...mesesCargados].sort();
  if (ms.length === 0) return null;
  let sel: string[];
  if (periodo === "12m") sel = ms.slice(-12);
  else if (/^\d{4}$/.test(periodo)) sel = ms.filter((m) => m.startsWith(periodo));
  else sel = ms.filter((m) => m === periodo);
  if (sel.length === 0) return null;
  return { desde: `${sel[0]}-01`, hasta: ultimoDia(sel[sel.length - 1]), meses: sel };
}
