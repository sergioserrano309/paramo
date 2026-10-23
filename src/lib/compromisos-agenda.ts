import type { Rol } from "@/config/roles";
import { addDaysYmd } from "@/lib/format";
import type { CompromisoAgendaItem } from "@/lib/types/compromiso";

/**
 * Filtros de la agenda (as-is cFilter).
 * «7 días» incluye hoy (fecha entre hoy y hoy+7), igual que el HTML.
 */
export const FILTROS_AGENDA = [
  "pendientes",
  "vencidos",
  "hoy",
  "semana",
  "asignadas",
  "hechos",
] as const;

export type FiltroAgenda = (typeof FILTROS_AGENDA)[number];

/** Tarjeta agregada. Un responsable sin rol cuenta como comercial (as-is cRole). */
export type GrupoAgenda = "comercial" | "supervisor";

export function etiquetaFiltro(filtro: FiltroAgenda, rol: Rol): string {
  switch (filtro) {
    case "pendientes":
      return "Pendientes";
    case "vencidos":
      return "Vencidos";
    case "hoy":
      return "Hoy";
    case "semana":
      return "7 días";
    case "asignadas":
      return rol === "supervisor" ? "Asignadas por mí" : "Asignadas";
    case "hechos":
      return "Hechos";
  }
}

export function grupoDe(c: CompromisoAgendaItem): GrupoAgenda {
  return c.responsable_rol === "supervisor" ? "supervisor" : "comercial";
}

export function etiquetaGrupo(grupo: GrupoAgenda): string {
  return grupo === "supervisor" ? "Supervisores" : "Comerciales";
}

/**
 * «Asignadas por mí» = las creé yo y el responsable es otra persona.
 * En el comercial, «Asignadas» = el supervisor se las dejó (flag asignado).
 */
export function esAsignadaVisible(
  c: CompromisoAgendaItem,
  userId: string,
  rol: Rol,
): boolean {
  if (rol === "supervisor") {
    return c.creado_por === userId && c.responsable_id !== userId;
  }
  return c.asignado;
}

export function pasaFiltro(
  c: CompromisoAgendaItem,
  filtro: FiltroAgenda,
  hoy: string,
  userId: string,
  rol: Rol,
): boolean {
  const pendiente = !c.hecho;
  switch (filtro) {
    case "pendientes":
      return pendiente;
    case "vencidos":
      return pendiente && c.fecha < hoy;
    case "hoy":
      return pendiente && c.fecha === hoy;
    case "semana":
      return pendiente && c.fecha >= hoy && c.fecha <= addDaysYmd(hoy, 7);
    case "asignadas":
      return pendiente && esAsignadaVisible(c, userId, rol);
    case "hechos":
      return c.hecho;
  }
}

export function ordenarAgenda(
  items: CompromisoAgendaItem[],
  filtro: FiltroAgenda,
): CompromisoAgendaItem[] {
  const copy = items.slice();
  if (filtro === "hechos") {
    copy.sort((a, b) =>
      (b.hecho_en || b.fecha).localeCompare(a.hecho_en || a.fecha),
    );
    return copy.slice(0, 100);
  }
  copy.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es"),
  );
  return copy;
}

export type GrupoLista = {
  label: string;
  late: boolean;
  items: CompromisoAgendaItem[];
};

export function grupoFecha(
  fecha: string,
  hoy: string,
): { label: string; late: boolean } {
  if (fecha < hoy) return { label: "Vencidos", late: true };
  if (fecha === hoy) return { label: "Hoy", late: false };
  if (fecha === addDaysYmd(hoy, 1)) return { label: "Mañana", late: false };
  if (fecha <= addDaysYmd(hoy, 7)) {
    return { label: "Próximos 7 días", late: false };
  }
  return { label: "Más adelante", late: false };
}

export function partirGrupos(
  items: CompromisoAgendaItem[],
  filtro: FiltroAgenda,
  hoy: string,
): GrupoLista[] {
  const grupos: GrupoLista[] = [];
  for (const c of items) {
    const g =
      filtro === "hechos"
        ? { label: "Hechos", late: false }
        : grupoFecha(c.fecha, hoy);
    const last = grupos[grupos.length - 1];
    if (!last || last.label !== g.label) {
      grupos.push({ label: g.label, late: g.late, items: [c] });
    } else {
      last.items.push(c);
    }
  }
  return grupos;
}

export type StatsAgenda = {
  pendientes: number;
  vencidos: number;
  cumplido30: string;
  aTiempo: string;
  proximo: { fecha: string; titulo: string } | null;
};

/** Números de una tarjeta de rol. La ventana de 30 días usa la fecha límite. */
export function statsDeGrupo(
  items: CompromisoAgendaItem[],
  hoy: string,
): StatsAgenda {
  const pendientes = items.filter((c) => !c.hecho);
  const vencidos = pendientes.filter((c) => c.fecha < hoy);
  const desde = addDaysYmd(hoy, -30);
  const ventana = items.filter((c) => c.fecha >= desde && c.fecha <= hoy);
  const cumplidos = ventana.filter((c) => c.hecho);
  const aTiempoN = cumplidos.filter(
    (c) => (c.hecho_en || "") <= c.fecha,
  ).length;
  const proximo = pendientes
    .slice()
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.titulo.localeCompare(b.titulo, "es"),
    )[0];

  return {
    pendientes: pendientes.length,
    vencidos: vencidos.length,
    cumplido30: ventana.length
      ? `${Math.round((cumplidos.length / ventana.length) * 100)}%`
      : "—",
    aTiempo: cumplidos.length
      ? `${Math.round((aTiempoN / cumplidos.length) * 100)}%`
      : "—",
    proximo: proximo
      ? { fecha: proximo.fecha, titulo: proximo.titulo }
      : null,
  };
}

export function subtituloAgenda(
  items: CompromisoAgendaItem[],
  hoy: string,
  grupoNombre: string | null,
): string {
  const desde = addDaysYmd(hoy, -30);
  const ventana = items.filter((c) => c.fecha >= desde && c.fecha <= hoy);
  if (!ventana.length) {
    return "Llamadas, visitas, muestras y cotizaciones pendientes";
  }
  const ok = ventana.filter((c) => c.hecho).length;
  const pct = Math.round((ok / ventana.length) * 100);
  const quien = grupoNombre ? ` · ${grupoNombre}` : "";
  return `Cumplimiento últimos 30 días${quien}: ${pct}% (${ok} de ${ventana.length})`;
}

export function vacioAgenda(filtro: FiltroAgenda): { title: string; body: string } {
  if (filtro === "vencidos") {
    return {
      title: "Nada vencido",
      body: "Agrega uno con el botón de arriba o desde la ficha de un prospecto.",
    };
  }
  if (filtro === "hechos") {
    return {
      title: "Sin compromisos aquí",
      body: "Los compromisos cumplidos aparecerán aquí.",
    };
  }
  return {
    title: "Sin compromisos aquí",
    body: "Agrega uno con el botón de arriba o desde la ficha de un prospecto.",
  };
}
