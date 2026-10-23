import { todayBogota } from "@/lib/format";

/** Suma `dias` a una fecha YYYY-MM-DD (as-is addDays). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d.toLocaleDateString("en-CA");
}

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «5 sep» o «5 sep 25» si no es del año en curso (as-is fDate). */
export function fechaCorta(fecha: string): string {
  if (!fecha) return "";
  const d = new Date(`${fecha}T12:00:00`);
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : "";
  return `${d.getDate()} ${MES[d.getMonth()]}${anio}`;
}

/** «Hoy», «Mañana», «Ayer» o la fecha corta (as-is dateTxt). */
export function textoFecha(fecha: string): string {
  const hoy = todayBogota();
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  return fechaCorta(fecha);
}
