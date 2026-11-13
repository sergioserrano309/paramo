import { TIPO_CLIENTE_PVP } from "@/config/productos";
import type {
  PrecioProducto,
  PreciosProducto,
  TipoClientePrecio,
} from "@/lib/types/producto";

/**
 * Lógica de precios por tipo de cliente (as-is ppNorm / ppPrice / ppTxt / priceFor).
 * Pura y sin acceso a datos: la usan el panel de productos y las cotizaciones.
 */

/** Monedas en que se puede cotizar. El catálogo guarda un PVP por moneda. */
export const MONEDAS = ["COP", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export function isMoneda(v: unknown): v is Moneda {
  return v === "COP" || v === "USD";
}

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

/** Redondeo del as-is: a decenas de pesos; en USD, a centavos. */
function redondear(n: number, moneda: Moneda): number {
  return moneda === "USD" ? Math.round(n * 100) / 100 : Math.round(n / 10) * 10;
}

/** Redondeo de un monto a los decimales de la moneda (COP: entero; USD: centavos). */
export function redondearMoneda(n: number, moneda: Moneda): number {
  return moneda === "USD" ? Math.round(n * 100) / 100 : Math.round(n);
}

/** Precio resultante de una definición sobre el PVP; 0 si no hay definición. */
export function precioDesdeDefinicion(
  pvp: number,
  def: PrecioProducto | null,
  moneda: Moneda = "COP",
): number {
  if (!def) return 0;
  return def.modo === "pct" ? redondear(pvp * (1 - def.v / 100), moneda) : def.v;
}

/** Precio por la lista general (% del tipo de cliente) sobre el PVP. */
export function precioListaGeneral(
  pvp: number,
  pct: number,
  moneda: Moneda = "COP",
): number {
  return redondear(pvp * (1 - pct / 100), moneda);
}

export function textoPrecio(def: PrecioProducto | null): string {
  if (!def) return "lista general";
  if (def.modo === "pct") return `${def.v}% bajo PVP`;
  return `precio fijo ${formatCOP(def.v)}`;
}

/** PVP del producto en la moneda dada; 0 si no tiene precio en esa moneda. */
export function pvpEnMoneda(
  producto: { precio_publico: number; precio_publico_usd: number },
  moneda: Moneda,
): number {
  return (moneda === "USD" ? producto.precio_publico_usd : producto.precio_publico) || 0;
}

/**
 * Precio unitario para un tipo de cliente en la moneda dada: precio especial en firme del
 * producto, si existe; si no, la lista general. El consumidor final paga el PVP.
 *
 * En USD el precio especial solo aplica si está definido en % (se aplica sobre el PVP USD);
 * un «precio fijo» está en pesos y no se convierte, así que cae a la lista general.
 * Devuelve 0 si el producto no tiene precio en esa moneda.
 */
export function precioParaTipo(
  producto: {
    precio_publico: number;
    precio_publico_usd: number;
    precios: PreciosProducto;
  },
  tipo: TipoClientePrecio | undefined,
  moneda: Moneda = "COP",
): number {
  const pvp = pvpEnMoneda(producto, moneda);
  if (!tipo || tipo.codigo === TIPO_CLIENTE_PVP) return pvp;
  let def = normalizarPrecio(producto.precios[tipo.codigo]);
  if (moneda === "USD" && def?.modo !== "pct") def = null;
  const especial = precioDesdeDefinicion(pvp, def, moneda);
  if (especial > 0) return especial;
  return precioListaGeneral(pvp, tipo.descuento_pct, moneda);
}

export function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

/** Dinero en la moneda dada: COP sin decimales, USD con centavos. */
export function formatMoneda(n: number, moneda: Moneda): string {
  return moneda === "USD" ? formatUSD(n) : formatCOP(n);
}
