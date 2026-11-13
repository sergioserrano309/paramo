import { redondearMoneda, type Moneda } from "@/lib/precios";
import type { CotizacionItem, TotalesCotizacion } from "@/lib/types/cotizacion";

/**
 * Totales de una cotización (as-is qTotals). Pura: la usan la API (que persiste `total`),
 * el formulario (cálculo en vivo) y el PDF, así los tres coinciden al peso.
 */
export function calcularTotales(
  items: ReadonlyArray<{ cant: number; precio: number }>,
  descPct: number,
  ivaPct: number,
  moneda: Moneda = "COP",
): TotalesCotizacion {
  const r = (n: number) => redondearMoneda(n, moneda);
  const sub = r(items.reduce((a, i) => a + (Number(i.cant) || 0) * (Number(i.precio) || 0), 0));
  const d = Number(descPct) || 0;
  const dv = r((sub * d) / 100);
  const base = r(sub - dv);
  const iva = r((base * (Number(ivaPct) || 0)) / 100);
  return { sub, d, dv, base, iva, tot: r(base + iva) };
}

/**
 * Líneas cuyo precio el comercial cambió a mano respecto al catálogo (`precio_lista`).
 * Las cotizaciones anteriores al campo (precio_lista null) no cuentan como cambiadas.
 */
export function lineasConPrecioCambiado<T extends Pick<CotizacionItem, "precio" | "precio_lista">>(
  items: ReadonlyArray<T>,
): T[] {
  return items.filter((i) => i.precio_lista !== null && i.precio !== i.precio_lista);
}
