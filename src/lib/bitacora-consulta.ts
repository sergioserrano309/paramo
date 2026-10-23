import type { SupabaseClient } from "@supabase/supabase-js";
import { isRol, type Rol } from "@/config/roles";

export type EventoBitacora = {
  id: string;
  ocurrido_en: string;
  actor_nombre: string;
  rol: Rol;
  accion: string;
  detalle: string;
  ref_tabla: string | null;
  ref_id: string | null;
};

type EventoRow = {
  id: string;
  ocurrido_en: string;
  rol: string;
  accion: string;
  detalle: string;
  ref_tabla: string | null;
  ref_id: string | null;
  actor: { nombre: string } | null;
};

export const BITACORA_LIMITE = 200;

export type FiltroBitacora = { rol?: Rol; accion?: string; q?: string };

/**
 * Prepara el texto para un filtro `.or(...)` de PostgREST: `,` `(` `)` y `"` tienen
 * significado en esa sintaxis (un texto con comas podría añadir condiciones propias), y
 * `%` `_` `\` son comodines de ILIKE. Los primeros se reemplazan por espacio y los segundos
 * se escapan.
 */
function escaparLike(s: string): string {
  return s.replace(/[,()"]/g, " ").replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Bitácora más reciente primero (as-is: se muestran los 200 más recientes). */
export async function cargarBitacora(
  service: SupabaseClient,
  filtro: FiltroBitacora = {},
): Promise<EventoBitacora[] | null> {
  let query = service
    .from("bitacora")
    .select(
      "id, ocurrido_en, rol, accion, detalle, ref_tabla, ref_id, actor:profiles!bitacora_actor_id_fkey ( nombre )",
    )
    .order("ocurrido_en", { ascending: false })
    .limit(BITACORA_LIMITE);
  if (filtro.rol) query = query.eq("rol", filtro.rol);
  if (filtro.accion) query = query.eq("accion", filtro.accion);
  if (filtro.q) {
    const t = escaparLike(filtro.q.trim().slice(0, 80));
    if (t) query = query.or(`detalle.ilike.%${t}%,accion.ilike.%${t}%`);
  }
  const { data, error } = await query;
  if (error) return null;
  return ((data ?? []) as unknown as EventoRow[]).map((r) => ({
    id: r.id,
    ocurrido_en: r.ocurrido_en,
    actor_nombre: r.actor?.nombre || "—",
    rol: isRol(r.rol) ? r.rol : "comercial",
    accion: r.accion,
    detalle: r.detalle ?? "",
    ref_tabla: r.ref_tabla,
    ref_id: r.ref_id,
  }));
}

/** Acciones distintas de los últimos eventos, para el selector de filtro. */
export async function cargarAccionesBitacora(
  service: SupabaseClient,
): Promise<string[]> {
  const { data } = await service
    .from("bitacora")
    .select("accion")
    .order("ocurrido_en", { ascending: false })
    .limit(2_000);
  return [...new Set((data ?? []).map((r) => r.accion as string))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}
