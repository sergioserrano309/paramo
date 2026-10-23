import type { SupabaseClient } from "@supabase/supabase-js";
import type { Modulo } from "@/config/permissions";
import type { Rol } from "@/config/roles";
import { can } from "@/lib/can";
import { todayBogota } from "@/lib/format";

export type Insignia = { n: number; tono: "alerta" | "marca" | "suave" };

/**
 * Contadores del menú (as-is navHTML): compromisos vencidos, observaciones por atender,
 * precios y descuentos por aprobar. Son consultas de conteo; no traen filas.
 */
export async function cargarInsignias(
  service: SupabaseClient,
  rol: Rol,
): Promise<Partial<Record<Modulo, Insignia>>> {
  const hoy = todayBogota();
  const esSupervisor = rol === "supervisor";

  // El comercial no cuenta los compromisos cuyo responsable es un supervisor.
  const vencidosQuery = esSupervisor
    ? service
        .from("compromisos")
        .select("id", { count: "exact", head: true })
        .eq("hecho", false)
        .lt("fecha", hoy)
    : service
        .from("compromisos")
        .select("id, responsable:profiles!compromisos_responsable_id_fkey!inner ( rol )", {
          count: "exact",
          head: true,
        })
        .neq("responsable.rol", "supervisor")
        .eq("hecho", false)
        .lt("fecha", hoy);

  const [vencidos, observaciones, cotizaciones, productos] = await Promise.all([
    vencidosQuery,
    service
      .from("observaciones")
      .select("id", { count: "exact", head: true })
      .eq("estado", "abierta"),
    service
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .eq("estado", can(rol, "asignar") ? "pendiente" : "rechazada"),
    can(rol, "asignar")
      ? service.from("productos").select("precios_pendientes").limit(500)
      : Promise.resolve({ data: [] as Array<{ precios_pendientes: unknown }>, error: null }),
  ]);

  const out: Partial<Record<Modulo, Insignia>> = {};
  const poner = (m: Modulo, n: number | null, tono: Insignia["tono"]) => {
    if (n && n > 0) out[m] = { n, tono };
  };

  poner("compromisos", vencidos.count, "alerta");
  poner("cotizaciones", cotizaciones.count, "alerta");
  if (rol === "comercial") poner("dashboard", observaciones.count, "marca");
  if (esSupervisor) poner("supervision", observaciones.count, "suave");

  const preciosPendientes = (productos.data ?? []).reduce((a, p) => {
    const v = p.precios_pendientes;
    return a + (v && typeof v === "object" ? Object.keys(v as object).length : 0);
  }, 0);
  poner("productos", preciosPendientes, "alerta");

  return out;
}
