import type { ProximoCompromiso } from "@/lib/types/compromiso";
import type { SupabaseClient } from "@supabase/supabase-js";

type CompromisoPendienteRow = {
  id: string;
  prospecto_id: string;
  titulo: string;
  tipo: string;
  fecha: string;
};

/**
 * Lee pendientes con prospecto y deja el más próximo por prospecto_id
 * (as-is nextComp: !hecho, orden por fecha).
 * Si la tabla aún no existe en el proyecto, devuelve mapa vacío.
 */
export async function fetchProximosPorProspecto(
  service: SupabaseClient,
  prospectoIds: string[],
): Promise<Record<string, ProximoCompromiso>> {
  const map: Record<string, ProximoCompromiso> = {};
  if (prospectoIds.length === 0) return map;

  const { data, error } = await service
    .from("compromisos")
    .select("id, prospecto_id, titulo, tipo, fecha")
    .eq("hecho", false)
    .in("prospecto_id", prospectoIds)
    .order("fecha", { ascending: true })
    .limit(2000);

  if (error || !data) return map;

  for (const row of data as CompromisoPendienteRow[]) {
    if (!row.prospecto_id || map[row.prospecto_id]) continue;
    map[row.prospecto_id] = {
      id: row.id,
      prospecto_id: row.prospecto_id,
      titulo: row.titulo,
      tipo: row.tipo,
      fecha: row.fecha,
    };
  }
  return map;
}
