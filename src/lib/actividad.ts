import type { SupabaseClient } from "@supabase/supabase-js";
import { todayBogota } from "@/lib/format";

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

/**
 * Escribe en `prospectos.actividad` (jsonb de main). Los módulos que llegaron
 * de la otra rama llamaban una tabla `prospecto_actividad`; aquí se adapta
 * al historial que ya lee la ficha. Si falla, no tumba la operación principal.
 */
export async function registrarActividad(
  service: SupabaseClient,
  args: {
    prospectoId: string;
    tipo: string;
    texto: string;
    usuarioId: string;
    tocarContacto?: boolean;
  },
): Promise<void> {
  try {
    const { data, error } = await service
      .from("prospectos")
      .select("actividad")
      .eq("id", args.prospectoId)
      .maybeSingle();
    if (error || !data) return;

    const hoy = todayBogota();
    const actividad = appendActividad(data.actividad, {
      f: hoy,
      t: args.tipo.slice(0, 40),
      x: args.texto.slice(0, 1_000),
      u: args.usuarioId,
    });
    const patch: { actividad: ActividadItem[]; ultimo_contacto?: string; actualizado_por: string } =
      {
        actividad,
        actualizado_por: args.usuarioId,
      };
    if (args.tocarContacto) patch.ultimo_contacto = hoy;

    await service.from("prospectos").update(patch).eq("id", args.prospectoId);
  } catch {
    // Trazabilidad: un fallo del historial no revierte la operación ya hecha.
  }
}
