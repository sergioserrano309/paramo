import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "@/config/roles";
import { STALE_DAYS } from "@/config/funnel";
import { fetchCompromisosAgenda } from "@/lib/compromisos";
import { sumarDias } from "@/lib/fechas";
import { daysBetween, localDayBogota, todayBogota } from "@/lib/format";
import { cargarObservaciones } from "@/lib/observaciones";
import { cargarProductos } from "@/lib/productos";
import type { CompromisoAgendaItem } from "@/lib/types/compromiso";
import type { ObservacionItem } from "@/lib/types/observacion";
import type { ProductoListItem } from "@/lib/types/producto";
import type { VentaMes, VentaResumenFila } from "@/lib/types/venta";
import { cargarMesesVentas, resumenVentas } from "@/lib/ventas";
import { rangoDePeriodo } from "@/lib/ventas-periodo";

export type EtapaDashboard = {
  codigo: string;
  nombre: string;
  cantidad: number;
  valor: number;
};

export type ProspectoStale = {
  id: string;
  empresa: string;
  etapa: string;
  valor: number;
  dias: number;
};

export type ClientePerdido = { cliente: string; promedio: number; ultimaCompra: string };

export type DatosDashboard = {
  vacio: boolean;
  /** Ventas: mes de referencia (el último cargado) y el anterior. */
  ref: string | null;
  prev: string | null;
  ventasRef: number;
  ventasPrev: number;
  cambioMes: number | null;
  anioRef: string;
  acumulado: number;
  cambioAnio: number | null;
  pipelinePonderado: number;
  prospectosActivos: number;
  vencidos: number;
  agenda: CompromisoAgendaItem[];
  agendaTotal: number;
  funnel: EtapaDashboard[];
  ganados: number;
  perdidos: number;
  serie12: Array<{ mes: string; valor: number }>;
  topClientes: VentaResumenFila[];
  topProductos: VentaResumenFila[];
  mixCanal: VentaResumenFila[];
  sinContacto: ProspectoStale[];
  clientesPerdidos: ClientePerdido[];
  hayDosMeses: boolean;
  lanzamientos: ProductoListItem[];
  observacionesAbiertas: ObservacionItem[];
};

const pct = (a: number, b: number): number | null => (b ? ((a - b) / b) * 100 : null);

/**
 * Datos del Dashboard (as-is vDashboard). Todo se agrega en el servidor; el navegador recibe
 * cifras, no tablas completas. «Interesados» y calificación de producto del as-is dependen de
 * la ficha del prospecto y de la retroalimentación (aún no construidas) y no se incluyen.
 */
export async function cargarDashboard(
  service: SupabaseClient,
  rol: Rol,
  userId: string,
): Promise<DatosDashboard | null> {
  const hoy = todayBogota();

  const [prospectosRes, etapasRes, compromisos, meses, productos, observaciones] =
    await Promise.all([
      service
        .from("prospectos")
        .select("id, empresa, etapa_codigo, activo, valor_mensual_estimado, ultimo_contacto, creado_en")
        .limit(2_000),
      service
        .from("etapas_funnel")
        .select("codigo, nombre, orden, probabilidad, en_pipeline")
        .eq("activo", true)
        .order("orden", { ascending: true }),
      fetchCompromisosAgenda(service, rol === "supervisor" ? null : userId),
      cargarMesesVentas(service),
      cargarProductos(service),
      rol === "comercial" ? cargarObservaciones(service, 50) : Promise.resolve([]),
    ]);
  if (prospectosRes.error || etapasRes.error || !compromisos || !meses || !productos) {
    return null;
  }

  const prospectos = prospectosRes.data ?? [];
  const etapas = etapasRes.data ?? [];

  if (prospectos.length === 0 && meses.length === 0 && compromisos.length === 0) {
    return { vacio: true } as DatosDashboard;
  }

  // ---- Ventas ----
  const ms = meses.map((m: VentaMes) => m.mes).sort();
  const bm = new Map(meses.map((m) => [m.mes, m.valor]));
  const ref = ms.length ? ms[ms.length - 1] : null;
  const prev = ms.length > 1 ? ms[ms.length - 2] : null;
  const ventasRef = ref ? (bm.get(ref) ?? 0) : 0;
  const ventasPrev = prev ? (bm.get(prev) ?? 0) : 0;
  const anioRef = ref ? ref.slice(0, 4) : String(new Date().getFullYear());
  const acumulado = ms
    .filter((m) => m.startsWith(anioRef) && m <= (ref ?? "9"))
    .reduce((a, m) => a + (bm.get(m) ?? 0), 0);
  const pyMs = ms.filter(
    (m) => ref && m.startsWith(String(Number(anioRef) - 1)) && m.slice(5) <= ref.slice(5),
  );
  const pyTotal = pyMs.reduce((a, m) => a + (bm.get(m) ?? 0), 0);

  // ---- Funnel y pipeline ----
  const vivos = prospectos.filter((p) => p.activo !== false);
  const pipelineCodigos = new Set(etapas.filter((e) => e.en_pipeline).map((e) => e.codigo as string));
  const activos = vivos.filter((p) => pipelineCodigos.has(p.etapa_codigo as string));
  const probabilidad = new Map(etapas.map((e) => [e.codigo as string, Number(e.probabilidad) || 0]));
  const pipelinePonderado = activos.reduce(
    (a, p) =>
      a +
      (Number(p.valor_mensual_estimado) || 0) * ((probabilidad.get(p.etapa_codigo as string) ?? 0) / 100),
    0,
  );
  const ganados = prospectos.filter((p) => p.etapa_codigo === "ganado").length;
  const perdidos = prospectos.filter((p) => p.etapa_codigo === "perdido").length;

  // Las 6 primeras etapas (hasta Ganado), como STAGES.slice(0, 6) del as-is.
  const funnel: EtapaDashboard[] = etapas.slice(0, 6).map((e) => {
    const ps = vivos.filter((p) => p.etapa_codigo === e.codigo);
    return {
      codigo: e.codigo as string,
      nombre: e.nombre as string,
      cantidad: ps.length,
      valor: ps.reduce((a, p) => a + (Number(p.valor_mensual_estimado) || 0), 0),
    };
  });

  // ---- Compromisos ----
  const pendientes = compromisos.filter((c) => !c.hecho);
  const vencidos = pendientes.filter((c) => c.fecha < hoy).length;
  const agendaTodos = pendientes
    .filter((c) => c.fecha <= sumarDias(hoy, 7))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ---- Ventas del mes de referencia: tops, mix y clientes que dejaron de comprar ----
  let topClientes: VentaResumenFila[] = [];
  let topProductos: VentaResumenFila[] = [];
  let mixCanal: VentaResumenFila[] = [];
  let clientesPerdidos: ClientePerdido[] = [];
  const rangoRef = ref ? rangoDePeriodo(ref, ms) : null;
  if (ref && rangoRef) {
    const [porCliente, porProducto, porCanal] = await Promise.all([
      resumenVentas(service, { ...rangoRef, por: "cliente" }),
      resumenVentas(service, { ...rangoRef, por: "producto" }),
      resumenVentas(service, { ...rangoRef, por: "canal" }),
    ]);
    if (!porCliente || !porProducto || !porCanal) return null;
    topClientes = porCliente.slice(0, 6);
    topProductos = porProducto.slice(0, 6);
    mixCanal = porCanal;

    if (ms.length >= 2) {
      const previos = ms.slice(-4, -1);
      const rangoPrev = rangoDePeriodo("12m", previos);
      if (rangoPrev) {
        const previosClientes = await resumenVentas(service, { ...rangoPrev, por: "cliente" });
        if (!previosClientes) return null;
        const actuales = new Set(porCliente.map((c) => c.clave));
        clientesPerdidos = previosClientes
          .filter((c) => !actuales.has(c.clave))
          .map((c) => ({
            cliente: c.etiqueta,
            promedio: c.valor / previos.length,
            ultimaCompra: (c.ultima ?? "").slice(0, 7),
          }))
          .sort((a, b) => b.promedio - a.promedio);
      }
    }
  }

  // ---- Alertas ----
  const nombreEtapa = new Map(etapas.map((e) => [e.codigo as string, e.nombre as string]));
  // Más días sin contacto primero (equivale a ordenar por último contacto ascendente).
  const sinContacto: ProspectoStale[] = activos
    .map((p) => {
      const ultimo = (p.ultimo_contacto as string | null) ?? localDayBogota(p.creado_en as string);
      return {
        id: p.id as string,
        empresa: p.empresa as string,
        etapa: nombreEtapa.get(p.etapa_codigo as string) ?? (p.etapa_codigo as string),
        valor: Number(p.valor_mensual_estimado) || 0,
        dias: daysBetween(ultimo, hoy),
      };
    })
    .filter((p) => p.dias >= STALE_DAYS)
    .sort((a, b) => b.dias - a.dias);

  return {
    vacio: false,
    ref,
    prev,
    ventasRef,
    ventasPrev,
    cambioMes: prev ? pct(ventasRef, ventasPrev) : null,
    anioRef,
    acumulado,
    cambioAnio: pyMs.length ? pct(acumulado, pyTotal) : null,
    pipelinePonderado,
    prospectosActivos: activos.length,
    vencidos,
    agenda: agendaTodos.slice(0, 8),
    agendaTotal: agendaTodos.length,
    funnel,
    ganados,
    perdidos,
    serie12: ms.slice(-12).map((m) => ({ mes: m, valor: bm.get(m) ?? 0 })),
    topClientes,
    topProductos,
    mixCanal,
    sinContacto,
    clientesPerdidos,
    hayDosMeses: ms.length >= 2,
    lanzamientos: productos.filter((p) => p.estado === "lanzamiento" || p.estado === "desarrollo"),
    observacionesAbiertas: (observaciones ?? []).filter((o) => o.estado === "abierta"),
  };
}
