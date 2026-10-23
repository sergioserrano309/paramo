import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "@/config/roles";
import { cargarCotizaciones } from "@/lib/cotizaciones";
import { sumarDias } from "@/lib/fechas";
import { localDayBogota, todayBogota } from "@/lib/format";
import { normalizarPrecio, textoPrecio } from "@/lib/precios";
import { cargarProductos } from "@/lib/productos";

export type DescuentoPorAprobar = {
  id: string;
  numero: string;
  cliente: string;
  solicitante: string;
  descuento: number;
  total: number;
  solicitado_en: string | null;
};

export type PrecioPorAprobar = {
  producto_id: string;
  producto: string;
  tipo: string;
  propuesta: string;
  por: string;
  en: string;
};

export type RespuestaSupervisor = {
  id: string;
  numero: string;
  cliente: string;
  rechazada: boolean;
  descuento: number;
  total: number;
};

export type DatosAprobaciones = {
  descuentos: DescuentoPorAprobar[];
  precios: PrecioPorAprobar[];
  respuestas: RespuestaSupervisor[];
};

/**
 * Lo que espera una decisión del supervisor (descuentos y precios propuestos) y, para el
 * comercial, las respuestas recientes a sus solicitudes (as-is dashQPanel / ppPanel).
 */
export async function cargarAprobaciones(
  service: SupabaseClient,
  rol: Rol,
  userId: string,
  nombresTipo: Map<string, string>,
): Promise<DatosAprobaciones> {
  const vacio: DatosAprobaciones = { descuentos: [], precios: [], respuestas: [] };

  if (rol === "supervisor") {
    const [cotizaciones, productos] = await Promise.all([
      cargarCotizaciones(service),
      cargarProductos(service),
    ]);
    return {
      descuentos: (cotizaciones ?? [])
        .filter((c) => c.estado === "pendiente")
        .map((c) => ({
          id: c.id,
          numero: c.numero,
          cliente: c.cliente_nombre,
          solicitante: c.creado_por_nombre,
          descuento: c.desc_solicitado ?? c.desc_pct,
          total: c.total,
          solicitado_en: c.solicitado_en,
        })),
      precios: (productos ?? []).flatMap((p) =>
        Object.entries(p.precios_pendientes).map(([tipo, v]) => ({
          producto_id: p.id,
          producto: p.nombre,
          tipo: nombresTipo.get(tipo) ?? tipo,
          propuesta: textoPrecio(normalizarPrecio({ modo: v.modo, v: v.v })),
          por: v.por_nombre,
          en: v.en,
        })),
      ),
      respuestas: [],
    };
  }

  const cotizaciones = await cargarCotizaciones(service);
  const semana = sumarDias(todayBogota(), -7);
  return {
    ...vacio,
    respuestas: (cotizaciones ?? [])
      .filter(
        (c) =>
          c.estado === "rechazada" ||
          (c.estado === "final" &&
            c.aprobacion !== null &&
            c.aprobacion.por !== userId &&
            localDayBogota(c.aprobacion.en) >= semana),
      )
      .map((c) => ({
        id: c.id,
        numero: c.numero,
        cliente: c.cliente_nombre,
        rechazada: c.estado === "rechazada",
        descuento: c.rechazo?.solicitado ?? c.aprobacion?.desc ?? 0,
        total: c.total,
      })),
  };
}
