import type { SupabaseClient } from "@supabase/supabase-js";
import { isEstadoCotizacion } from "@/config/cotizaciones";
import type { Rol } from "@/config/roles";
import { parseActividad } from "@/lib/actividad";
import { puedeVerCompromiso } from "@/lib/can";
import {
  COMPROMISO_AGENDA_SELECT,
  mapCompromisoAgenda,
  type CompromisoAgendaRow,
} from "@/lib/compromisos";
import { mapObservacionRow, OBSERVACION_SELECT } from "@/lib/observaciones";
import { mapProspectoRow, PROSPECTO_SELECT_LIST, type ProspectoRow } from "@/lib/prospectos";
import type { ActividadItem, FichaProspecto } from "@/lib/types/ficha";

type FilaProspecto = ProspectoRow & {
  inactivo_en: string | null;
  motivo_inactivo: string;
  creador: { nombre: string } | null;
};

type FilaObservacion = Parameters<typeof mapObservacionRow>[0];

/**
 * Todo lo que muestra la ficha de un prospecto (as-is openProspect), en una sola consulta
 * por parte. El historial sale de `prospectos.actividad` (main). Los compromisos se
 * filtran con la regla de main: el comercial solo ve los suyos.
 */
export async function cargarFicha(
  service: SupabaseClient,
  id: string,
  rol: Rol,
  userId: string,
): Promise<FichaProspecto | null> {
  const [prospectoRes, compromisosRes, observacionesRes, cotizacionesRes, productosRes, interesRes] =
    await Promise.all([
      service
        .from("prospectos")
        .select(PROSPECTO_SELECT_LIST)
        .eq("id", id)
        .maybeSingle(),
      service
        .from("compromisos")
        .select(COMPROMISO_AGENDA_SELECT)
        .eq("prospecto_id", id)
        .order("hecho", { ascending: true })
        .order("fecha", { ascending: true })
        .limit(200),
      service
        .from("observaciones")
        .select(OBSERVACION_SELECT)
        .eq("prospecto_id", id)
        .order("estado", { ascending: true })
        .order("creado_en", { ascending: false })
        .limit(100),
      service
        .from("cotizaciones")
        .select("id, numero, estado, fecha, desc_pct, total")
        .eq("prospecto_id", id)
        .order("fecha", { ascending: false })
        .limit(100),
      service
        .from("productos")
        .select("id, nombre, estado")
        .neq("estado", "descontinuado")
        .order("nombre", { ascending: true })
        .limit(500),
      service.from("prospecto_productos").select("producto_id").eq("prospecto_id", id),
    ]);

  if (
    prospectoRes.error ||
    !prospectoRes.data ||
    compromisosRes.error ||
    observacionesRes.error ||
    cotizacionesRes.error ||
    productosRes.error ||
    interesRes.error
  ) {
    return null;
  }

  const fila = prospectoRes.data as unknown as FilaProspecto;
  const interesados = new Set((interesRes.data ?? []).map((r) => r.producto_id as string));

  const actividad: ActividadItem[] = parseActividad(fila.actividad)
    .map((a, i) => ({
      id: `${fila.id}-${i}`,
      fecha: a.f,
      tipo: a.t,
      texto: a.x,
      usuario_nombre: a.u || "—",
    }))
    .reverse();

  return {
    prospecto: mapProspectoRow(fila),
    inactivo_en: fila.inactivo_en,
    motivo_inactivo: fila.motivo_inactivo ?? "",
    creado_por_nombre: fila.creado?.nombre || "—",
    actividad,
    compromisos: (compromisosRes.data ?? [])
      .map((c) => mapCompromisoAgenda(c as unknown as CompromisoAgendaRow))
      .filter((c) => puedeVerCompromiso(rol, userId, c.responsable_id)),
    observaciones: (observacionesRes.data ?? []).map((o) =>
      mapObservacionRow(o as unknown as FilaObservacion),
    ),
    cotizaciones: (cotizacionesRes.data ?? []).map((c) => ({
      id: c.id as string,
      numero: c.numero as string,
      estado: isEstadoCotizacion(c.estado as string) ? (c.estado as never) : ("borrador" as never),
      fecha: c.fecha as string,
      desc_pct: Number(c.desc_pct) || 0,
      total: Number(c.total) || 0,
    })),
    productos: (productosRes.data ?? []).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      estado: p.estado as string,
      interesado: interesados.has(p.id as string),
    })),
  };
}

/** Un código de catálogo (canal, fuente, tipo de cliente) debe existir y estar activo. */
export async function codigoCatalogoActivo(
  service: SupabaseClient,
  tabla: "canales" | "fuentes" | "tipos_cliente",
  codigo: string | null,
): Promise<boolean> {
  if (!codigo) return true;
  const { data, error } = await service
    .from(tabla)
    .select("codigo")
    .eq("codigo", codigo)
    .eq("activo", true)
    .maybeSingle();
  return !error && !!data;
}
