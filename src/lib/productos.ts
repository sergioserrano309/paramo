import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ESTADOS_PRODUCTO,
  LINEAS_PRODUCTO,
  PCT_MAX_PRODUCTO,
  TIPO_CLIENTE_PVP,
  isEstadoProducto,
  isLineaProducto,
} from "@/config/productos";
import { normalizarPrecio, textoPrecio } from "@/lib/precios";
import type {
  PrecioProducto,
  PreciosPendientes,
  PreciosProducto,
  ProductoListItem,
  TipoClientePrecio,
} from "@/lib/types/producto";

export const PRODUCTO_SELECT = `
  id, nombre, sku, linea, presentacion, estado, precio_publico, lanzamiento,
  descripcion, precios, precios_pendientes, creado_en, actualizado_en
`;

export const PRODUCTOS_LIMIT = 500;

export type ProductoRow = {
  id: string;
  nombre: string;
  sku: string;
  linea: string;
  presentacion: string;
  estado: string;
  precio_publico: number | string;
  lanzamiento: string | null;
  descripcion: string;
  precios: unknown;
  precios_pendientes: unknown;
  creado_en: string;
  actualizado_en: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function mapProductoRow(
  row: ProductoRow,
  nombresPerfil: Map<string, string>,
): ProductoListItem {
  const precios: PreciosProducto = {};
  for (const [tipo, raw] of Object.entries(asRecord(row.precios))) {
    const n = normalizarPrecio(raw);
    if (n) precios[tipo] = n;
  }

  const pendientes: PreciosPendientes = {};
  for (const [tipo, raw] of Object.entries(asRecord(row.precios_pendientes))) {
    const p = asRecord(raw);
    const por = typeof p.por === "string" ? p.por : "";
    const modo = p.modo === "pct" || p.modo === "precio" ? p.modo : null;
    pendientes[tipo] = {
      modo,
      v: Number(p.v) || 0,
      por,
      por_nombre: nombresPerfil.get(por) ?? "—",
      en: typeof p.en === "string" ? p.en : "",
    };
  }

  return {
    id: row.id,
    nombre: row.nombre,
    sku: row.sku ?? "",
    linea: isLineaProducto(row.linea) ? row.linea : "otra",
    presentacion: row.presentacion ?? "",
    estado: isEstadoProducto(row.estado) ? row.estado : "desarrollo",
    precio_publico: Number(row.precio_publico) || 0,
    lanzamiento: row.lanzamiento,
    descripcion: row.descripcion ?? "",
    precios,
    precios_pendientes: pendientes,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

/** Ids de quienes propusieron precios, para resolver su nombre en una sola consulta. */
function proponentes(rows: ProductoRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const raw of Object.values(asRecord(row.precios_pendientes))) {
      const por = asRecord(raw).por;
      if (typeof por === "string" && por) ids.add(por);
    }
  }
  return [...ids];
}

export async function nombresDePerfiles(
  service: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await service.from("profiles").select("id, nombre").in("id", ids);
  for (const p of data ?? []) {
    out.set(p.id as string, (p.nombre as string) || (p.id as string).slice(0, 8));
  }
  return out;
}

export async function cargarProductos(
  service: SupabaseClient,
): Promise<ProductoListItem[] | null> {
  const { data, error } = await service
    .from("productos")
    .select(PRODUCTO_SELECT)
    .order("nombre", { ascending: true })
    .limit(PRODUCTOS_LIMIT);
  if (error) return null;
  const rows = (data ?? []) as unknown as ProductoRow[];
  const nombres = await nombresDePerfiles(service, proponentes(rows));
  return rows.map((r) => mapProductoRow(r, nombres));
}

export async function cargarProducto(
  service: SupabaseClient,
  id: string,
): Promise<ProductoListItem | null> {
  const { data, error } = await service
    .from("productos")
    .select(PRODUCTO_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as ProductoRow;
  const nombres = await nombresDePerfiles(service, proponentes([row]));
  return mapProductoRow(row, nombres);
}

export async function cargarTiposClientePrecio(
  service: SupabaseClient,
): Promise<TipoClientePrecio[] | null> {
  const { data, error } = await service
    .from("tipos_cliente")
    .select("codigo, nombre, descuento_pct_default, orden")
    .eq("activo", true)
    .order("orden", { ascending: true });
  if (error) return null;
  return (data ?? []).map((t) => ({
    codigo: t.codigo as string,
    nombre: t.nombre as string,
    descuento_pct: Number(t.descuento_pct_default) || 0,
  }));
}

// ---------------------------------------------------------------------------
// Validación (zod) compartida por POST y PATCH
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max));

const precioPropuesto = z
  .object({
    modo: z.enum(["pct", "precio"]),
    v: z.coerce.number().finite(),
  })
  .nullable();

export const productoCamposSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  precio_publico: z.coerce.number().int().min(1).max(1_000_000_000),
  linea: z.enum(LINEAS_PRODUCTO.map((l) => l.codigo) as [string, ...string[]]),
  estado: z.enum(ESTADOS_PRODUCTO.map((e) => e.codigo) as [string, ...string[]]),
  presentacion: optionalText(80),
  sku: optionalText(80),
  descripcion: optionalText(2_000),
  lanzamiento: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "lanzamiento",
    }),
  precios: z.record(z.string().max(40), precioPropuesto),
});

// ---------------------------------------------------------------------------
// Precios por tipo de cliente: propuesta → firme / pendiente (as-is prForm)
// ---------------------------------------------------------------------------

const mismoPrecio = (a: PrecioProducto | null, b: PrecioProducto | null) =>
  (!a && !b) || (!!a && !!b && a.modo === b.modo && a.v === b.v);

/** Valida rangos del as-is; devuelve el mensaje del primer error o null. */
export function validarPropuesta(
  propuesta: Record<string, PrecioProducto | null>,
  tipos: TipoClientePrecio[],
  esAlta: boolean,
): string | null {
  const conPrecio = tipos.filter((t) => t.codigo !== TIPO_CLIENTE_PVP);
  for (const t of conPrecio) {
    const n = propuesta[t.codigo] ?? null;
    if (!n) {
      if (esAlta) {
        return `Define el precio para ${t.nombre} (en % sobre el PVP o precio fijo).`;
      }
      continue;
    }
    if (n.modo === "pct" && !(n.v >= 0 && n.v <= PCT_MAX_PRODUCTO)) {
      return `El porcentaje de ${t.nombre} debe estar entre 0 y ${PCT_MAX_PRODUCTO}.`;
    }
    if (n.modo === "precio" && !(n.v > 0)) {
      return `El precio de ${t.nombre} debe ser mayor que cero.`;
    }
  }
  const validos = new Set(conPrecio.map((t) => t.codigo));
  for (const codigo of Object.keys(propuesta)) {
    if (!validos.has(codigo)) return "Tipo de cliente no válido.";
  }
  return null;
}

export type ResultadoPrecios = {
  precios: Record<string, PrecioProducto>;
  pendientes: Record<string, unknown>;
  cambios: string[];
};

/**
 * Aplica la propuesta de precios del formulario.
 * - Supervisor: queda en firme de inmediato y limpia el pendiente de ese tipo.
 * - Comercial: si coincide con lo vigente descarta su pendiente; si no, queda pendiente
 *   hasta que el supervisor lo apruebe (mientras tanto se cotiza con la lista general).
 */
export function aplicarPropuestaPrecios(args: {
  vigentes: PreciosProducto;
  pendientes: PreciosPendientes;
  propuesta: Record<string, PrecioProducto | null>;
  tipos: TipoClientePrecio[];
  esSupervisor: boolean;
  userId: string;
  ahoraISO: string;
}): ResultadoPrecios {
  const { vigentes, propuesta, tipos, esSupervisor, userId, ahoraISO } = args;
  const nombreTipo = new Map(tipos.map((t) => [t.codigo, t.nombre]));
  const precios: Record<string, PrecioProducto> = { ...vigentes };
  const pendientes: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(args.pendientes)) {
    pendientes[k] = { modo: p.modo, v: p.v, por: p.por, en: p.en };
  }
  const cambios: string[] = [];

  for (const [tipo, n] of Object.entries(propuesta)) {
    const ahora = normalizarPrecio(precios[tipo]);
    const etiqueta = nombreTipo.get(tipo) ?? tipo;

    if (esSupervisor) {
      if (!mismoPrecio(ahora, n)) {
        if (n) precios[tipo] = n;
        else delete precios[tipo];
        cambios.push(`${etiqueta}: ${textoPrecio(n)}`);
      } else if (pendientes[tipo]) {
        cambios.push(`${etiqueta}: ${textoPrecio(n)} (confirmado)`);
      }
      delete pendientes[tipo];
      continue;
    }

    if (mismoPrecio(ahora, n)) {
      delete pendientes[tipo];
      continue;
    }
    const pend = args.pendientes[tipo];
    const pendNorm = pend ? normalizarPrecio({ modo: pend.modo, v: pend.v }) : null;
    if (pend && mismoPrecio(pendNorm, n)) continue;

    pendientes[tipo] = { modo: n ? n.modo : null, v: n ? n.v : 0, por: userId, en: ahoraISO };
    cambios.push(`${etiqueta}: ${textoPrecio(n)}`);
  }

  return { precios, pendientes, cambios };
}
