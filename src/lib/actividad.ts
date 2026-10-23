/** Línea del historial de la ficha (as-is p.actividad). */
export type ActividadItem = {
  /** Día Bogotá YYYY-MM-DD. */
  f: string;
  /** Tipo: Etapa, Estado, Llamada, Visita, … */
  t: string;
  /** Texto visible. */
  x: string;
  /** Usuario que lo registró. */
  u: string;
};

export const TIPOS_ACTIVIDAD = [
  "Llamada",
  "Visita",
  "WhatsApp",
  "Correo",
  "Degustación",
  "Reunión",
] as const;

export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

export function isTipoActividad(value: string): value is TipoActividad {
  return (TIPOS_ACTIVIDAD as readonly string[]).includes(value);
}

const MAX_ACTIVIDAD = 300;

export function parseActividad(value: unknown): ActividadItem[] {
  if (!Array.isArray(value)) return [];
  const out: ActividadItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.f !== "string" ||
      typeof row.t !== "string" ||
      typeof row.x !== "string"
    ) {
      continue;
    }
    out.push({
      f: row.f,
      t: row.t,
      x: row.x,
      u: typeof row.u === "string" ? row.u : "",
    });
  }
  return out;
}

/** Agrega una línea y descarta las más viejas si la ficha crece de más. */
export function appendActividad(
  value: unknown,
  item: ActividadItem,
): ActividadItem[] {
  const next = [...parseActividad(value), item];
  return next.length > MAX_ACTIVIDAD
    ? next.slice(next.length - MAX_ACTIVIDAD)
    : next;
}
