import type { SupabaseClient } from "@supabase/supabase-js";
import { isEstadoCotizacion } from "@/config/cotizaciones";
import type { Rol } from "@/config/roles";
import { COMPROMISO_SELECT, mapCompromisoRow } from "@/lib/compromisos";
import { puedeVerCompromiso } from "@/lib/compromisos-permisos";
import { mapObservacionRow, OBSERVACION_SELECT } from "@/lib/observaciones";
import { mapProspectoRow, PROSPECTO_SELECT_LIST, type ProspectoRow } from "@/lib/prospectos";
import type { ActividadItem, FichaProspecto } from "@/lib/types/ficha";

type FilaProspecto = ProspectoRow & {
  inactivo_en: string | null;
  motivo_inactivo: string;
  creador: { nombre: string } | null;
};

type FilaCompromiso = Parameters<typeof mapCompromisoRow>[0];
type FilaObservacion = Parameters<typeof mapObservacionRow>[0];

/**
 * Todo lo que muestra la ficha de un prospecto (as-is openProspect), en una sola consulta
 * por parte. Los compromisos se filtran según lo que el rol puede ver.
 */
export async function cargarFicha(
  service: SupabaseClient,
  id: string,
  rol: Rol,
): Promise<FichaProspecto | null> {
  const [prospectoRes, actividadRes, compromisosRes, observacionesRes, cotizacionesRes, productosRes, interesRes] =
    await Promise.all([
      service
        .from("prospectos")
        .select(
          `${PROSPECTO_SELECT_LIST}, inactivo_en, motivo_inactivo,
           creador:profiles!prospectos_creado_por_fkey ( nombre )`,
        )
        .eq("id", id)
        .maybeSingle(),
      service
        .from("prospecto_actividad")
        .select("id, fecha, tipo, texto, usuario:profiles!prospecto_actividad_usuario_id_fkey ( nombre )")
        .eq("prospecto_id", id)
        .order("creado_en", { ascending: false })
        .limit(200),
      service
        .from("compromisos")
        .select(COMPROMISO_SELECT)
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
    actividadRes.error ||
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

  const actividad: ActividadItem[] = (actividadRes.data ?? []).map((a) => ({
    id: a.id as string,
    fecha: a.fecha as string,
    tipo: a.tipo as string,
    texto: (a.texto as string) ?? "",
    usuario_nombre:
      (a.usuario as unknown as { nombre: string } | null)?.nombre || "—",
  }));

  return {
    prospecto: mapProspectoRow(fila),
    inactivo_en: fila.inactivo_en,
    motivo_inactivo: fila.motivo_inactivo ?? "",
    creado_por_nombre: fila.creador?.nombre || "—",
    actividad,
    compromisos: (compromisosRes.data ?? [])
      .map((c) => mapCompromisoRow(c as unknown as FilaCompromiso))
      .filter((c) => puedeVerCompromiso(rol, c)),
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
