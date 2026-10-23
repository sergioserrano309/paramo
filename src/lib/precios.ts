import { TIPO_CLIENTE_PVP } from "@/config/productos";
import type {
  PrecioProducto,
  PreciosProducto,
  TipoClientePrecio,
} from "@/lib/types/producto";

/**
 * Lógica de precios por tipo de cliente (as-is ppNorm / ppPrice / ppTxt / priceFor).
 * Pura y sin acceso a datos: la usan el panel de productos y, luego, cotizaciones.
 */

/** Normaliza un valor guardado; devuelve null si no define un precio válido. */
export function normalizarPrecio(o: unknown): PrecioProducto | null {
  if (!o || typeof o !== "object") return null;
  const { modo, v } = o as { modo?: unknown; v?: unknown };
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (modo === "pct" && n >= 0) return { modo: "pct", v: n };
  if (modo === "precio" && n > 0) return { modo: "precio", v: n };
  return null;
}

/** Redondeo del as-is: a decenas de pesos. */
function aDecenas(n: number): number {
  return Math.round(n / 10) * 10;
}

/** Precio resultante de una definición sobre el PVP; 0 si no hay definición. */
export function precioDesdeDefinicion(
  pvp: number,
  def: PrecioProducto | null,
): number {
  if (!def) return 0;
  return def.modo === "pct" ? aDecenas(pvp * (1 - def.v / 100)) : def.v;
}

/** Precio por la lista general (% del tipo de cliente) sobre el PVP. */
export function precioListaGeneral(pvp: number, pct: number): number {
  return aDecenas(pvp * (1 - pct / 100));
}

export function textoPrecio(def: PrecioProducto | null): string {
  if (!def) return "lista general";
  if (def.modo === "pct") return `${def.v}% bajo PVP`;
  return `precio fijo ${formatCOP(def.v)}`;
}

/**
 * Precio unitario para un tipo de cliente: precio especial en firme del producto, si
 * existe; si no, la lista general. El consumidor final paga el PVP.
 */
export function precioParaTipo(
  producto: { precio_publico: number; precios: PreciosProducto },
  tipo: TipoClientePrecio | undefined,
): number {
  const pvp = producto.precio_publico || 0;
  if (!tipo || tipo.codigo === TIPO_CLIENTE_PVP) return pvp;
  const especial = precioDesdeDefinicion(
    pvp,
    normalizarPrecio(producto.precios[tipo.codigo]),
  );
  if (especial > 0) return especial;
  return precioListaGeneral(pvp, tipo.descuento_pct);
}

export function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}
