import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CAJAS,
  DESC_MAX,
  DESC_TOPE,
  ESTADOS_EDITABLES,
  PAGOS,
  isEstadoCotizacion,
  type EstadoCotizacion,
  type Pago,
} from "@/config/cotizaciones";
import type { Rol } from "@/config/roles";
import type { AuthContext } from "@/lib/auth";
import { calcularTotales } from "@/lib/cotizaciones-calculo";
import { todayBogota } from "@/lib/format";
import { formatCOP, precioParaTipo } from "@/lib/precios";
import {
  PRODUCTO_SELECT,
  mapProductoRow,
  nombresDePerfiles,
  type ProductoRow,
} from "@/lib/productos";
import type {
  AprobacionDescuento,
  CotizacionItem,
  ContactoCliente,
  CotizacionListItem,
  DecisionDescuento,
  ProspectoCotizable,
} from "@/lib/types/cotizacion";
import type { ProductoListItem, TipoClientePrecio } from "@/lib/types/producto";
import { filtroResponsablesOcultos, idsProspectosOcultos } from "@/lib/visibilidad";

export const COTIZACION_SELECT = `
  id, numero, version, prospecto_id, cliente_nombre, tipo_cliente_codigo, fecha,
  validez_dias, pago, entrega, notas, items, desc_pct, iva_pct, total, estado,
  desc_solicitado, solicitado_en, aprobacion, rechazo, final_en, enviada_en,
  cerrada_en, creado_por, creado_en
`;

export const COTIZACIONES_LIMIT = 500;

export type CotizacionRow = {
  id: string;
  numero: string;
  version: number;
  prospecto_id: string | null;
  cliente_nombre: string;
  tipo_cliente_codigo: string | null;
  fecha: string;
  validez_dias: number;
  pago: string;
  entrega: string;
  notas: string;
  items: unknown;
  desc_pct: number | string;
  iva_pct: number;
  total: number | string;
  estado: string;
  desc_solicitado: number | string | null;
  solicitado_en: string | null;
  aprobacion: unknown;
  rechazo: unknown;
  final_en: string | null;
  enviada_en: string | null;
  cerrada_en: string | null;
  creado_por: string | null;
  creado_en: string;
};

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function mapItems(raw: unknown): CotizacionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => {
    const o = rec(it);
    return {
      producto_id: typeof o.producto_id === "string" ? o.producto_id : null,
      nombre: str(o.nombre),
      presentacion: str(o.presentacion),
      caja: str(o.caja),
      cant: Number(o.cant) || 0,
      precio: Number(o.precio) || 0,
    };
  });
}

function mapDecision(raw: unknown, nombres: Map<string, string>): DecisionDescuento | null {
  if (!raw || typeof raw !== "object") return null;
  const o = rec(raw);
  const por = str(o.por);
  return {
    por,
    por_nombre: nombres.get(por) ?? "—",
    en: str(o.en),
    solicitado: Number(o.solicitado) || 0,
    comentario: str(o.comentario),
  };
}

export function mapCotizacionRow(
  row: CotizacionRow,
  nombres: Map<string, string>,
): CotizacionListItem {
  const aprob = mapDecision(row.aprobacion, nombres);
  return {
    id: row.id,
    numero: row.numero,
    version: row.version,
    prospecto_id: row.prospecto_id,
    cliente_nombre: row.cliente_nombre ?? "",
    tipo_cliente_codigo: row.tipo_cliente_codigo,
    fecha: row.fecha,
    validez_dias: row.validez_dias,
    pago: (PAGOS as readonly string[]).includes(row.pago) ? (row.pago as Pago) : "Contado",
    entrega: row.entrega ?? "",
    notas: row.notas ?? "",
    items: mapItems(row.items),
    desc_pct: Number(row.desc_pct) || 0,
    iva_pct: row.iva_pct,
    total: Number(row.total) || 0,
    estado: isEstadoCotizacion(row.estado) ? row.estado : "borrador",
    desc_solicitado: row.desc_solicitado == null ? null : Number(row.desc_solicitado),
    solicitado_en: row.solicitado_en,
    aprobacion: aprob
      ? ({ ...aprob, desc: Number(rec(row.aprobacion).desc) || 0 } as AprobacionDescuento)
      : null,
    rechazo: mapDecision(row.rechazo, nombres),
    final_en: row.final_en,
    enviada_en: row.enviada_en,
    cerrada_en: row.cerrada_en,
    creado_por: row.creado_por,
    creado_por_nombre: (row.creado_por && nombres.get(row.creado_por)) || "—",
    creado_en: row.creado_en,
  };
}

function idsDePerfiles(rows: CotizacionRow[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.creado_por) ids.add(r.creado_por);
    for (const j of [r.aprobacion, r.rechazo]) {
      const por = rec(j).por;
      if (typeof por === "string" && por) ids.add(por);
    }
  }
  return [...ids];
}

/**
 * Cotizaciones, de la más reciente a la más antigua. Con `estados` solo trae esos: los
 * paneles de aprobación del Dashboard y del menú necesitan unas pocas, no las 500.
 */
export async function cargarCotizaciones(
  service: SupabaseClient,
  opciones: { rol: Rol; estados?: readonly string[] },
): Promise<CotizacionListItem[] | null> {
  let query = service
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .order("numero", { ascending: false })
    .limit(COTIZACIONES_LIMIT);
  if (opciones.estados?.length) query = query.in("estado", [...opciones.estados]);
  const { data, error } = await query;
  if (error) return null;
  // El comercial no ve las cotizaciones de prospectos del supervisor.
  const ocultos = await idsProspectosOcultos(service, opciones.rol);
  const rows = ((data ?? []) as unknown as CotizacionRow[]).filter(
    (r) => !r.prospecto_id || !ocultos.has(r.prospecto_id),
  );
  const nombres = await nombresDePerfiles(service, idsDePerfiles(rows));
  return rows.map((r) => mapCotizacionRow(r, nombres));
}

export async function cargarCotizacion(
  service: SupabaseClient,
  id: string,
): Promise<CotizacionListItem | null> {
  const { data, error } = await service
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as CotizacionRow;
  const nombres = await nombresDePerfiles(service, idsDePerfiles([row]));
  return mapCotizacionRow(row, nombres);
}

type ProspectoCotizableRow = {
  id: string;
  empresa: string;
  ciudad: string;
  tipo_cliente_codigo: string | null;
  responsable_id: string;
  etapa_codigo: string;
  activo: boolean;
  canales: { tipo_cliente_codigo: string | null } | null;
};

/** Tipo de cliente por defecto si ni el prospecto ni su canal lo definen (as-is tipoOf). */
const TIPO_CLIENTE_FALLBACK = "tienda";

export async function cargarProspectosCotizables(
  service: SupabaseClient,
  soloId?: string,
  rol?: Rol,
): Promise<ProspectoCotizable[] | null> {
  let query = service
    .from("prospectos")
    .select(
      `id, empresa, ciudad, tipo_cliente_codigo, responsable_id, etapa_codigo, activo,
       canales ( tipo_cliente_codigo )`,
    )
    .order("empresa", { ascending: true })
    .limit(1_000);
  if (soloId) query = query.eq("id", soloId);
  // Con `rol` (listado del panel) el comercial no recibe los prospectos del supervisor.
  const ocultos = rol ? await filtroResponsablesOcultos(rol) : null;
  if (ocultos) query = query.not("responsable_id", "in", ocultos);
  const { data, error } = await query;
  if (error) return null;
  return ((data ?? []) as unknown as ProspectoCotizableRow[]).map((p) => ({
    id: p.id,
    empresa: p.empresa,
    ciudad: p.ciudad ?? "",
    tipo_cliente_codigo:
      p.tipo_cliente_codigo ?? p.canales?.tipo_cliente_codigo ?? TIPO_CLIENTE_FALLBACK,
    responsable_id: p.responsable_id,
    etapa_codigo: p.etapa_codigo,
    activo: p.activo !== false,
  }));
}

/**
 * Datos de contacto del cliente que salen en el PDF. Se piden solo al descargar uno (no
 * viajan con el listado de cotizaciones: AGENTS §3.6, nada de datos personales «por si
 * acaso»).
 */
export async function cargarContactoCliente(
  service: SupabaseClient,
  prospectoId: string,
): Promise<ContactoCliente | null> {
  const { data, error } = await service
    .from("prospectos")
    .select("nit, contacto, cargo, telefono, email, ciudad")
    .eq("id", prospectoId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    nit: (data.nit as string) ?? "",
    contacto: (data.contacto as string) ?? "",
    cargo: (data.cargo as string) ?? "",
    telefono: (data.telefono as string) ?? "",
    email: (data.email as string) ?? "",
    ciudad: (data.ciudad as string) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Permisos de negocio (as-is canEditQ / canCreateQ, con canEditP)
// ---------------------------------------------------------------------------

/**
 * Solo el responsable del prospecto edita sus cotizaciones (o, si el prospecto ya no
 * existe, quien la creó). Cambia respecto al as-is (canEditQ), donde el comercial `editar`
 * tocaba todas: las de otros se pueden ver, no editar.
 */
export function puedeEditarCotizacion(
  _rol: Rol,
  userId: string,
  cot: Pick<CotizacionListItem, "creado_por">,
  responsableProspecto: string | null,
  prospectoExiste: boolean,
): boolean {
  if (prospectoExiste) return responsableProspecto === userId;
  return cot.creado_por === userId;
}

// ---------------------------------------------------------------------------
// Validación del cuerpo de guardado
// ---------------------------------------------------------------------------

export const cotizacionGuardarSchema = z.object({
  modo: z.enum(["borrador", "final"]),
  prospecto_id: z.string().uuid(),
  // El tipo de cliente sale del prospecto y la fecha es la del registro: el servidor los fija.
  validez_dias: z.coerce.number().int().min(1).max(365),
  pago: z.enum(PAGOS),
  entrega: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(200)),
  notas: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(2_000)),
  desc_pct: z.coerce.number().min(0).max(DESC_TOPE),
  iva_pct: z.coerce.number().refine((v) => v === 0 || v === 19),
  items: z
    .array(
      z.object({
        producto_id: z.string().uuid().nullable(),
        caja: z
          .union([z.enum(CAJAS), z.literal(""), z.null(), z.undefined()])
          .transform((v) => v ?? ""),
        cant: z.coerce.number().min(0).max(1_000_000),
      }),
    )
    .max(60),
});

export type CotizacionGuardar = z.infer<typeof cotizacionGuardarSchema>;

export type ResultadoGuardado =
  | { ok: false; error: string }
  | {
      ok: true;
      campos: Record<string, unknown>;
      estado: EstadoCotizacion;
      accion: string;
      detalle: (numero: string) => string;
    };

/**
 * Arma lo que se persiste al guardar (as-is qSave + qPrepare), con una diferencia clave:
 * los precios de las líneas los recalcula el SERVIDOR desde el catálogo; el navegador solo
 * manda producto, caja y cantidad. El as-is confiaba en el precio que calculaba el cliente.
 */
export function prepararGuardado(args: {
  auth: AuthContext;
  existente: CotizacionListItem | null;
  body: CotizacionGuardar;
  prospecto: ProspectoCotizable;
  tipo: TipoClientePrecio;
  productos: Map<string, ProductoListItem>;
  ahoraISO: string;
}): ResultadoGuardado {
  const { auth, existente, body, prospecto, tipo, productos, ahoraISO } = args;
  const esSupervisor = auth.profile.rol === "supervisor";

  const items: CotizacionItem[] = [];
  for (const it of body.items) {
    if (!it.producto_id || !(it.cant > 0)) continue;
    const producto = productos.get(it.producto_id);
    if (!producto) return { ok: false, error: "Hay un producto que ya no existe en el catálogo." };
    const precio = precioParaTipo(producto, tipo);
    if (!precio) {
      return {
        ok: false,
        error: "Hay productos sin PVP. Complétalo en el módulo Productos.",
      };
    }
    items.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      presentacion: producto.presentacion,
      caja: it.caja,
      cant: it.cant,
      precio,
    });
  }
  if (items.length === 0) {
    return { ok: false, error: "Agrega al menos un producto con cantidad." };
  }
  if (body.modo === "final" && items.some((i) => !i.caja)) {
    return {
      ok: false,
      error: "Asigna el tipo de caja (A, B o C) a cada producto.",
    };
  }

  const totales = calcularTotales(items, body.desc_pct, body.iva_pct);
  const wasPend = existente?.estado === "pendiente";
  const base: Record<string, unknown> = {
    prospecto_id: prospecto.id,
    cliente_nombre: prospecto.empresa,
    tipo_cliente_codigo: tipo.codigo,
    fecha: existente?.fecha ?? todayBogota(),
    validez_dias: body.validez_dias,
    pago: body.pago,
    entrega: body.entrega,
    notas: body.notas,
    items,
    desc_pct: body.desc_pct,
    iva_pct: body.iva_pct,
    total: totales.tot,
    actualizado_por: auth.userId,
  };
  const esNueva = !existente;

  if (body.modo === "borrador") {
    return {
      ok: true,
      estado: "borrador",
      campos: { ...base, estado: "borrador", rechazo: null },
      accion: esNueva ? "Cotización creada" : "Cotización editada",
      detalle: (n) =>
        `${n} · ${prospecto.empresa} · ${formatCOP(totales.tot)}${wasPend ? " (se retiró la solicitud de aprobación)" : ""}`,
    };
  }

  // Un descuento ya aprobado por el supervisor no se vuelve a pedir si no cambia.
  const yaAprobado =
    body.desc_pct > DESC_MAX &&
    !!existente?.aprobacion &&
    existente.aprobacion.desc === body.desc_pct;

  if (body.desc_pct > DESC_MAX && !esSupervisor && !yaAprobado) {
    return {
      ok: true,
      estado: "pendiente",
      campos: {
        ...base,
        estado: "pendiente",
        desc_solicitado: body.desc_pct,
        solicitado_en: ahoraISO,
        rechazo: null,
      },
      accion: "Aprobación de descuento solicitada",
      detalle: (n) =>
        `${n} · ${prospecto.empresa} · ${body.desc_pct}% · ${formatCOP(totales.tot)}`,
    };
  }

  const version = (existente?.version ?? 0) + 1;
  let aprobacion: unknown = existente?.aprobacion
    ? {
        por: existente.aprobacion.por,
        en: existente.aprobacion.en,
        desc: existente.aprobacion.desc,
        solicitado: existente.aprobacion.solicitado,
        comentario: existente.aprobacion.comentario,
      }
    : null;
  if (body.desc_pct > DESC_MAX && !yaAprobado) {
    aprobacion = {
      por: auth.userId,
      en: ahoraISO,
      desc: body.desc_pct,
      solicitado: body.desc_pct,
      comentario: "Descuento del Supervisor",
    };
  } else if (!(existente?.aprobacion && existente.aprobacion.desc === body.desc_pct)) {
    aprobacion = null;
  }

  return {
    ok: true,
    estado: "final",
    campos: {
      ...base,
      estado: "final",
      version,
      final_en: ahoraISO,
      aprobacion,
      rechazo: null,
    },
    accion: "Cotización final generada",
    detalle: (n) =>
      `${n} v${version} · ${prospecto.empresa} · ${body.desc_pct ? body.desc_pct + "% desc. · " : ""}${formatCOP(totales.tot)}`,
  };
}

export function esEditable(estado: EstadoCotizacion): boolean {
  return ESTADOS_EDITABLES.includes(estado);
}


export async function cargarProductosPorId(
  service: SupabaseClient,
  ids: string[],
): Promise<Map<string, ProductoListItem> | null> {
  if (ids.length === 0) return new Map();
  const { data, error } = await service
    .from("productos")
    .select(PRODUCTO_SELECT)
    .in("id", ids);
  if (error) return null;
  // Aquí solo importan los precios en firme; los nombres de quien propuso no se usan.
  const sinNombres = new Map<string, string>();
  return new Map(
    ((data ?? []) as unknown as ProductoRow[]).map((r) => {
      const p = mapProductoRow(r, sinNombres);
      return [p.id, p] as const;
    }),
  );
}
