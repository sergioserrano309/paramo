import type { SupabaseClient } from "@supabase/supabase-js";
import { ACT_ETAPA } from "@/config/prospectos";
import { parseActividad } from "@/lib/actividad";
import { sumarDias } from "@/lib/fechas";
import { daysBetween, localDayBogota, todayBogota } from "@/lib/format";

export type KpisSupervision = {
  contactos: number;
  empresasContactadas: number;
  prospectosNuevos: number;
  valorNuevos: number;
  avancesFunnel: number;
  ganados: number;
  comprometidos: number;
  cumplidos: number;
  aTiempo: number;
  vencidosHoy: number;
  ultimoRegistro: { accion: string; en: string } | null;
  ultimoIngreso: string | null;
};

export type ActividadDia = { dia: string; n: number };

export type FilaCartera = {
  id: string;
  empresa: string;
  etapa: string;
  valor: number;
  diasSinContacto: number;
  /** Contactos registrados en el período (llamadas, visitas, correos…). */
  contactos: number;
  proximo: { fecha: string; titulo: string } | null;
  observacionesAbiertas: number;
};

export type DatosSupervision = {
  dias: number;
  kpis: KpisSupervision;
  actividad: ActividadDia[];
  cartera: FilaCartera[];
};

/** Acciones de sesión: no cuentan como «actividad» del comercial (as-is comEvents). */
const ACCIONES_SESION = ["Ingreso", "Salida"];
const DIAS_GRAFICA = 14;

/** Medianoche de Bogotá (UTC-5, sin horario de verano) del día dado, como ISO. */
function inicioDiaBogota(dia: string): string {
  return `${dia}T00:00:00-05:00`;
}

/**
 * Auditoría de la labor comercial (as-is vSupervision), acotada a un período de 7/30/90
 * días. Todo se agrega en el servidor; el navegador solo recibe cifras y la cartera.
 *
 * «Contactos con clientes» y «Avances en el funnel» salen del historial
 * `prospectos.actividad` (jsonb de main): tipo «Etapa» cuenta como avance.
 */
export async function cargarSupervision(
  service: SupabaseClient,
  dias: number,
): Promise<DatosSupervision | null> {
  const hoy = todayBogota();
  const desde = sumarDias(hoy, -(dias - 1));
  const desdeISO = inicioDiaBogota(desde);
  const desdeGrafica = inicioDiaBogota(sumarDias(hoy, -(DIAS_GRAFICA - 1)));

  const [
    nuevosRes,
    ganadosRes,
    actividadRes,
    debidosRes,
    vencidosRes,
    ultimoRes,
    ingresoRes,
    graficaRes,
    etapasRes,
    prospectosRes,
    pendientesRes,
    observacionesRes,
  ] = await Promise.all([
    service
      .from("prospectos")
      .select("valor_mensual_estimado")
      .gte("creado_en", desdeISO)
      .limit(5_000),
    service
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .eq("etapa_codigo", "ganado")
      .gte("ganado_en", desde)
      .lte("ganado_en", hoy),
    service
      .from("prospectos")
      .select("id, actividad")
      .limit(2_000),
    service
      .from("compromisos")
      .select("fecha, hecho, hecho_en, responsable:profiles!compromisos_responsable_id_fkey!inner ( rol )")
      .neq("responsable.rol", "supervisor")
      .gte("fecha", desde)
      .lte("fecha", hoy)
      .limit(5_000),
    service
      .from("compromisos")
      .select("id, responsable:profiles!compromisos_responsable_id_fkey!inner ( rol )", {
        count: "exact",
        head: true,
      })
      .neq("responsable.rol", "supervisor")
      .eq("hecho", false)
      .lt("fecha", hoy),
    service
      .from("bitacora")
      .select("accion, ocurrido_en")
      .eq("rol", "comercial")
      .not("accion", "in", `(${ACCIONES_SESION.join(",")})`)
      .order("ocurrido_en", { ascending: false })
      .limit(1),
    service
      .from("bitacora")
      .select("ocurrido_en")
      .eq("rol", "comercial")
      .eq("accion", "Ingreso")
      .order("ocurrido_en", { ascending: false })
      .limit(1),
    service
      .from("bitacora")
      .select("ocurrido_en")
      .eq("rol", "comercial")
      .not("accion", "in", `(${ACCIONES_SESION.join(",")})`)
      .gte("ocurrido_en", desdeGrafica)
      .limit(10_000),
    service.from("etapas_funnel").select("codigo, nombre, orden, en_pipeline"),
    service
      .from("prospectos")
      .select("id, empresa, etapa_codigo, valor_mensual_estimado, ultimo_contacto, creado_en")
      .eq("activo", true)
      .limit(1_000),
    service
      .from("compromisos")
      .select("prospecto_id, titulo, fecha")
      .eq("hecho", false)
      .not("prospecto_id", "is", null)
      .order("fecha", { ascending: true })
      .limit(2_000),
    service
      .from("observaciones")
      .select("prospecto_id")
      .eq("estado", "abierta")
      .not("prospecto_id", "is", null)
      .limit(2_000),
  ]);

  const fallos = [
    nuevosRes, ganadosRes, actividadRes, debidosRes, vencidosRes, ultimoRes, ingresoRes,
    graficaRes, etapasRes, prospectosRes, pendientesRes, observacionesRes,
  ].some((r) => r.error);
  if (fallos) return null;

  // Historial del período: «Etapa» = avance en el funnel; lo demás, contactos (as-is acts).
  let avances = 0;
  const contactosPorProspecto = new Map<string, number>();
  for (const row of actividadRes.data ?? []) {
    const pid = row.id as string;
    for (const a of parseActividad(row.actividad)) {
      if (!a.f || a.f < desde || a.f > hoy) continue;
      if (a.t === ACT_ETAPA) {
        avances += 1;
      } else {
        contactosPorProspecto.set(pid, (contactosPorProspecto.get(pid) ?? 0) + 1);
      }
    }
  }
  const contactos = [...contactosPorProspecto.values()].reduce((a, n) => a + n, 0);

  // KPI de compromisos del período (solo los que no son de un supervisor).
  const debidos = (debidosRes.data ?? []) as unknown as Array<{
    fecha: string;
    hecho: boolean;
    hecho_en: string | null;
  }>;
  const cumplidos = debidos.filter((c) => c.hecho);

  // Actividad diaria: 14 días en hora de Bogotá, con 0 en los días sin registros.
  const porDia = new Map<string, number>();
  for (const r of graficaRes.data ?? []) {
    const d = localDayBogota(r.ocurrido_en as string);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }
  const actividad: ActividadDia[] = [];
  for (let i = DIAS_GRAFICA - 1; i >= 0; i--) {
    const dia = sumarDias(hoy, -i);
    actividad.push({ dia, n: porDia.get(dia) ?? 0 });
  }

  // Cartera bajo seguimiento: activos en pipeline, primero sin próximo paso y más tiempo sin contacto.
  const etapas = new Map(
    (etapasRes.data ?? []).map((e) => [
      e.codigo as string,
      { nombre: e.nombre as string, enPipeline: e.en_pipeline as boolean },
    ]),
  );
  const proximos = new Map<string, { fecha: string; titulo: string }>();
  for (const c of pendientesRes.data ?? []) {
    const pid = c.prospecto_id as string;
    if (!proximos.has(pid)) proximos.set(pid, { fecha: c.fecha as string, titulo: c.titulo as string });
  }
  const abiertas = new Map<string, number>();
  for (const o of observacionesRes.data ?? []) {
    const pid = o.prospecto_id as string;
    abiertas.set(pid, (abiertas.get(pid) ?? 0) + 1);
  }

  const cartera: FilaCartera[] = (prospectosRes.data ?? [])
    .filter((p) => etapas.get(p.etapa_codigo as string)?.enPipeline)
    .map((p) => {
      const ultimo =
        (p.ultimo_contacto as string | null) ?? localDayBogota(p.creado_en as string);
      return {
        id: p.id as string,
        empresa: p.empresa as string,
        etapa: etapas.get(p.etapa_codigo as string)?.nombre ?? (p.etapa_codigo as string),
        valor: Number(p.valor_mensual_estimado) || 0,
        diasSinContacto: daysBetween(ultimo, hoy),
        contactos: contactosPorProspecto.get(p.id as string) ?? 0,
        proximo: proximos.get(p.id as string) ?? null,
        observacionesAbiertas: abiertas.get(p.id as string) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        Number(!!a.proximo) - Number(!!b.proximo) || b.diasSinContacto - a.diasSinContacto,
    );

  const ultimo = ultimoRes.data?.[0];
  return {
    dias,
    kpis: {
      contactos,
      empresasContactadas: contactosPorProspecto.size,
      prospectosNuevos: (nuevosRes.data ?? []).length,
      valorNuevos: (nuevosRes.data ?? []).reduce(
        (a, p) => a + (Number(p.valor_mensual_estimado) || 0),
        0,
      ),
      avancesFunnel: avances,
      ganados: ganadosRes.count ?? 0,
      comprometidos: debidos.length,
      cumplidos: cumplidos.length,
      aTiempo: cumplidos.filter((c) => (c.hecho_en ?? "") <= c.fecha).length,
      vencidosHoy: vencidosRes.count ?? 0,
      ultimoRegistro: ultimo
        ? { accion: ultimo.accion as string, en: ultimo.ocurrido_en as string }
        : null,
      ultimoIngreso: (ingresoRes.data?.[0]?.ocurrido_en as string | undefined) ?? null,
    },
    actividad,
    cartera,
  };
}
