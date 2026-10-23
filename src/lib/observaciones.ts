import type { SupabaseClient } from "@supabase/supabase-js";
import type { ObservacionItem } from "@/lib/types/observacion";

export const OBSERVACION_SELECT = `
  id, prospecto_id, texto, estado, autor_id, respuesta, atendida_en, creado_en,
  autor:profiles!observaciones_autor_id_fkey ( nombre ),
  prospecto:prospectos!observaciones_prospecto_id_fkey ( empresa )
`;

type ObservacionRow = {
  id: string;
  prospecto_id: string | null;
  texto: string;
  estado: string;
  autor_id: string | null;
  respuesta: string;
  atendida_en: string | null;
  creado_en: string;
  autor: { nombre: string } | null;
  prospecto: { empresa: string } | null;
};

export function mapObservacionRow(row: ObservacionRow): ObservacionItem {
  return {
    id: row.id,
    prospecto_id: row.prospecto_id,
    prospecto_empresa: row.prospecto?.empresa ?? null,
    texto: row.texto,
    estado: row.estado === "atendida" ? "atendida" : "abierta",
    autor_id: row.autor_id,
    autor_nombre: row.autor?.nombre || "—",
    respuesta: row.respuesta ?? "",
    atendida_en: row.atendida_en,
    creado_en: row.creado_en,
  };
}

/** Abiertas primero y más recientes arriba (as-is obsAll). */
export async function cargarObservaciones(
  service: SupabaseClient,
  limite = 100,
): Promise<ObservacionItem[] | null> {
  const [abiertas, atendidas] = await Promise.all([
    service
      .from("observaciones")
      .select(OBSERVACION_SELECT)
      .eq("estado", "abierta")
      .order("creado_en", { ascending: false })
      .limit(limite),
    service
      .from("observaciones")
      .select(OBSERVACION_SELECT)
      .eq("estado", "atendida")
      .order("creado_en", { ascending: false })
      .limit(limite),
  ]);
  if (abiertas.error || atendidas.error) return null;
  return [...(abiertas.data ?? []), ...(atendidas.data ?? [])].map((r) =>
    mapObservacionRow(r as unknown as ObservacionRow),
  );
}

export async function cargarObservacion(
  service: SupabaseClient,
  id: string,
): Promise<ObservacionItem | null> {
  const { data, error } = await service
    .from("observaciones")
    .select(OBSERVACION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapObservacionRow(data as unknown as ObservacionRow);
}
