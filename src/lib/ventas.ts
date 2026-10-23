import type { SupabaseClient } from "@supabase/supabase-js";
import { nombresDePerfiles } from "@/lib/productos";
import type {
  AgruparVentasPor,
  VentaMes,
  VentaResumenFila,
  VentaTotales,
} from "@/lib/types/venta";

type MesRow = {
  mes: string;
  filas: number;
  unidades: number | string;
  valor: number | string;
  archivo: string | null;
  cargado_en: string | null;
  cargado_por: string | null;
};

export async function cargarMesesVentas(
  service: SupabaseClient,
): Promise<VentaMes[] | null> {
  const { data, error } = await service
    .from("ventas_por_mes")
    .select("mes, filas, unidades, valor, archivo, cargado_en, cargado_por")
    .order("mes", { ascending: false })
    .limit(240);
  if (error) return null;
  const rows = (data ?? []) as unknown as MesRow[];
  const ids = [...new Set(rows.flatMap((r) => (r.cargado_por ? [r.cargado_por] : [])))];
  const nombres = await nombresDePerfiles(service, ids);
  return rows.map((r) => ({
    mes: r.mes,
    filas: r.filas,
    unidades: Number(r.unidades) || 0,
    valor: Number(r.valor) || 0,
    archivo: r.archivo ?? "",
    cargado_en: r.cargado_en,
    cargado_por_nombre: (r.cargado_por && nombres.get(r.cargado_por)) || "—",
  }));
}

type ResumenRow = {
  clave: string;
  etiqueta: string;
  canal: string;
  unidades: number | string;
  valor: number | string;
  ultima: string | null;
  clientes: number | string;
};

export async function resumenVentas(
  service: SupabaseClient,
  args: {
    desde: string;
    hasta: string;
    por: AgruparVentasPor;
    cliente?: string | null;
    productoClave?: string | null;
  },
): Promise<VentaResumenFila[] | null> {
  const { data, error } = await service.rpc("ventas_resumen", {
    p_desde: args.desde,
    p_hasta: args.hasta,
    p_por: args.por,
    p_cliente: args.cliente ?? null,
    p_producto_clave: args.productoClave ?? null,
  });
  if (error) return null;
  return ((data ?? []) as ResumenRow[]).map((r) => ({
    clave: r.clave,
    etiqueta: r.etiqueta,
    canal: r.canal ?? "",
    unidades: Number(r.unidades) || 0,
    valor: Number(r.valor) || 0,
    ultima: r.ultima,
    clientes: Number(r.clientes) || 0,
  }));
}

export async function totalesVentas(
  service: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<VentaTotales | null> {
  const { data, error } = await service.rpc("ventas_totales", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return null;
  const r = ((data ?? []) as Array<Record<string, number | string>>)[0];
  if (!r) return { valor: 0, unidades: 0, clientes: 0, filas: 0 };
  return {
    valor: Number(r.valor) || 0,
    unidades: Number(r.unidades) || 0,
    clientes: Number(r.clientes) || 0,
    filas: Number(r.filas) || 0,
  };
}
