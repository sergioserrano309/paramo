import type { SupabaseClient } from "@supabase/supabase-js";
import { parseActividad } from "@/lib/actividad";
import type { ProspectoListItem } from "@/lib/types/prospecto";

export const PROSPECTO_SELECT_LIST = `
  id, empresa, nit, contacto, cargo, telefono, email, ciudad,
  canal_codigo, fuente_codigo, etapa_codigo,
  valor_mensual_estimado, calificacion, notas, activo,
  motivo_perdida, motivo_inactivo, inactivo_en, etapa_desde, ganado_en,
  actividad, responsable_id, creado_en, ultimo_contacto,
  canales ( nombre ),
  fuentes ( nombre ),
  etapas_funnel ( nombre ),
  responsable:profiles!prospectos_responsable_id_fkey ( nombre ),
  creado:profiles!prospectos_creado_por_fkey ( nombre )
`;

export type ProspectoRow = {
  id: string;
  empresa: string;
  nit: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  ciudad: string;
  canal_codigo: string | null;
  fuente_codigo: string | null;
  etapa_codigo: string;
  valor_mensual_estimado: number | string;
  calificacion: number;
  notas: string;
  activo: boolean;
  motivo_perdida: string;
  motivo_inactivo: string;
  inactivo_en: string | null;
  etapa_desde: string;
  ganado_en: string | null;
  actividad: unknown;
  responsable_id: string;
  creado_en: string;
  ultimo_contacto: string | null;
  canales: { nombre: string } | null;
  fuentes: { nombre: string } | null;
  etapas_funnel: { nombre: string } | null;
  responsable: { nombre: string } | null;
  creado: { nombre: string } | null;
};

export function mapProspectoRow(row: ProspectoRow): ProspectoListItem {
  return {
    id: row.id,
    empresa: row.empresa,
    nit: row.nit ?? "",
    contacto: row.contacto ?? "",
    cargo: row.cargo ?? "",
    telefono: row.telefono ?? "",
    email: row.email ?? "",
    ciudad: row.ciudad ?? "",
    canal_codigo: row.canal_codigo,
    canal_nombre: row.canales?.nombre ?? null,
    fuente_codigo: row.fuente_codigo,
    fuente_nombre: row.fuentes?.nombre ?? null,
    etapa_codigo: row.etapa_codigo,
    etapa_nombre: row.etapas_funnel?.nombre ?? row.etapa_codigo,
    valor_mensual_estimado: Number(row.valor_mensual_estimado) || 0,
    calificacion: row.calificacion ?? 0,
    notas: row.notas ?? "",
    activo: row.activo !== false,
    motivo_perdida: row.motivo_perdida ?? "",
    motivo_inactivo: row.motivo_inactivo ?? "",
    inactivo_en: row.inactivo_en,
    etapa_desde: row.etapa_desde,
    ganado_en: row.ganado_en,
    actividad: parseActividad(row.actividad),
    responsable_id: row.responsable_id,
    responsable_nombre: row.responsable?.nombre ?? "—",
    creado_por_nombre: row.creado?.nombre ?? null,
    creado_en: row.creado_en,
    ultimo_contacto: row.ultimo_contacto,
    proximo_compromiso: null,
    observaciones_abiertas: 0,
  };
}

/**
 * Completa «próximo compromiso» y «observaciones abiertas» de un listado con dos consultas
 * acotadas a los ids dados (no una por prospecto).
 */
export async function adjuntarSeguimiento(
  service: SupabaseClient,
  items: ProspectoListItem[],
): Promise<ProspectoListItem[]> {
  if (items.length === 0) return items;
  const ids = items.map((p) => p.id);
  const [compromisos, observaciones] = await Promise.all([
    service
      .from("compromisos")
      .select("prospecto_id, titulo, fecha")
      .eq("hecho", false)
      .in("prospecto_id", ids)
      .order("fecha", { ascending: true })
      .limit(5_000),
    service
      .from("observaciones")
      .select("prospecto_id")
      .eq("estado", "abierta")
      .in("prospecto_id", ids)
      .limit(5_000),
  ]);

  const proximos = new Map<string, { fecha: string; titulo: string }>();
  for (const c of compromisos.data ?? []) {
    const pid = c.prospecto_id as string;
    if (!proximos.has(pid)) proximos.set(pid, { fecha: c.fecha as string, titulo: c.titulo as string });
  }
  const abiertas = new Map<string, number>();
  for (const o of observaciones.data ?? []) {
    const pid = o.prospecto_id as string;
    abiertas.set(pid, (abiertas.get(pid) ?? 0) + 1);
  }
  return items.map((p) => ({
    ...p,
    proximo_compromiso: proximos.get(p.id) ?? null,
    observaciones_abiertas: abiertas.get(p.id) ?? 0,
  }));
}
