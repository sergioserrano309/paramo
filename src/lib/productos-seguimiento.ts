import type { SupabaseClient } from "@supabase/supabase-js";

export type ResumenSeguimiento = { interesados: number; opiniones: number; promedio: number };

export type InteresadoProducto = { id: string; empresa: string; etapa: string };

export type OpinionProducto = {
  id: string;
  fecha: string;
  tipo: string;
  cliente: string;
  calif: number;
  texto: string;
  usuario_nombre: string;
};

/**
 * Interesados y opiniones de cada producto, para las tarjetas del catálogo y el
 * Dashboard. Dos consultas acotadas; el promedio ignora las opiniones sin calificar
 * (as-is avgCalif).
 */
export async function resumenSeguimientoProductos(
  service: SupabaseClient,
): Promise<Record<string, ResumenSeguimiento>> {
  const [interes, opiniones] = await Promise.all([
    service.from("prospecto_productos").select("producto_id").limit(20_000),
    service.from("producto_feedback").select("producto_id, calif").limit(20_000),
  ]);
  const out: Record<string, ResumenSeguimiento & { suma: number; conCalif: number }> = {};
  const get = (id: string) =>
    (out[id] ??= { interesados: 0, opiniones: 0, promedio: 0, suma: 0, conCalif: 0 });
  for (const r of interes.data ?? []) get(r.producto_id as string).interesados += 1;
  for (const r of opiniones.data ?? []) {
    // null = comentario «General» de un prospecto: no pertenece a ningún producto.
    if (!r.producto_id) continue;
    const o = get(r.producto_id as string);
    o.opiniones += 1;
    const c = Number(r.calif) || 0;
    if (c > 0) {
      o.suma += c;
      o.conCalif += 1;
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([id, o]) => [
      id,
      {
        interesados: o.interesados,
        opiniones: o.opiniones,
        promedio: o.conCalif ? o.suma / o.conCalif : 0,
      },
    ]),
  );
}

type FilaOpinion = {
  id: string;
  fecha: string;
  tipo: string;
  cliente: string;
  calif: number;
  texto: string;
  usuario: { nombre: string } | null;
};

export async function cargarSeguimientoProducto(
  service: SupabaseClient,
  id: string,
): Promise<{ interesados: InteresadoProducto[]; opiniones: OpinionProducto[] } | null> {
  const [interes, opiniones] = await Promise.all([
    service
      .from("prospecto_productos")
      .select(
        "prospecto:prospectos!prospecto_productos_prospecto_id_fkey ( id, empresa, activo, etapas_funnel ( nombre ) )",
      )
      .eq("producto_id", id)
      .limit(500),
    service
      .from("producto_feedback")
      .select(
        "id, fecha, tipo, cliente, calif, texto, usuario:profiles!producto_feedback_usuario_id_fkey ( nombre )",
      )
      .eq("producto_id", id)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(200),
  ]);
  if (interes.error || opiniones.error) return null;

  const interesados: InteresadoProducto[] = [];
  for (const r of interes.data ?? []) {
    const p = (r as unknown as {
      prospecto: { id: string; empresa: string; activo: boolean; etapas_funnel: { nombre: string } | null } | null;
    }).prospecto;
    // Como el as-is `interested()`: se cuentan los prospectos que siguen existiendo.
    if (p) interesados.push({ id: p.id, empresa: p.empresa, etapa: p.etapas_funnel?.nombre ?? "" });
  }
  interesados.sort((a, b) => a.empresa.localeCompare(b.empresa, "es"));

  return {
    interesados,
    opiniones: ((opiniones.data ?? []) as unknown as FilaOpinion[]).map((o) => ({
      id: o.id,
      fecha: o.fecha,
      tipo: o.tipo,
      cliente: o.cliente ?? "",
      calif: Number(o.calif) || 0,
      texto: o.texto ?? "",
      usuario_nombre: o.usuario?.nombre || "—",
    })),
  };
}

/** Opinión registrada desde la ficha de un prospecto. `producto_id` null = «General». */
export type FeedbackProspecto = {
  id: string;
  fecha: string;
  tipo: string;
  calif: number;
  texto: string;
  producto_id: string | null;
  producto_nombre: string;
  usuario_nombre: string;
};

type FilaFeedbackProspecto = {
  id: string;
  fecha: string;
  tipo: string;
  calif: number;
  texto: string;
  producto_id: string | null;
  producto: { nombre: string } | null;
  usuario: { nombre: string } | null;
};

/** Retroalimentación y degustaciones de un prospecto, la más reciente primero. */
export async function cargarFeedbackProspecto(
  service: SupabaseClient,
  prospectoId: string,
): Promise<FeedbackProspecto[] | null> {
  const { data, error } = await service
    .from("producto_feedback")
    .select(
      `id, fecha, tipo, calif, texto, producto_id,
       producto:productos!producto_feedback_producto_id_fkey ( nombre ),
       usuario:profiles!producto_feedback_usuario_id_fkey ( nombre )`,
    )
    .eq("prospecto_id", prospectoId)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) return null;
  return ((data ?? []) as unknown as FilaFeedbackProspecto[]).map((f) => ({
    id: f.id,
    fecha: f.fecha,
    tipo: f.tipo,
    calif: Number(f.calif) || 0,
    texto: f.texto ?? "",
    producto_id: f.producto_id,
    producto_nombre: f.producto?.nombre ?? "General",
    usuario_nombre: f.usuario?.nombre || "—",
  }));
}
