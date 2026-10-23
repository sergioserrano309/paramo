import type { TotalesCotizacion } from "@/lib/types/cotizacion";

/**
 * Totales de una cotización (as-is qTotals). Pura: la usan la API (que persiste `total`),
 * el formulario (cálculo en vivo) y el PDF, así los tres coinciden al peso.
 */
export function calcularTotales(
  items: ReadonlyArray<{ cant: number; precio: number }>,
  descPct: number,
  ivaPct: number,
): TotalesCotizacion {
  const sub = items.reduce((a, i) => a + (Number(i.cant) || 0) * (Number(i.precio) || 0), 0);
  const d = Number(descPct) || 0;
  const dv = Math.round((sub * d) / 100);
  const base = sub - dv;
  const iva = Math.round((base * (Number(ivaPct) || 0)) / 100);
  return { sub, d, dv, base, iva, tot: base + iva };
}
