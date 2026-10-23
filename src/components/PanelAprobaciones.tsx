import Link from "next/link";
import { DESC_MAX } from "@/config/cotizaciones";
import type { DatosAprobaciones } from "@/lib/aprobaciones";
import { formatCOP } from "@/lib/precios";

const linkClass =
  "font-bold text-paramo-teal-ink underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Pendientes de decisión del supervisor (descuentos y precios) o, para el comercial, las
 * respuestas a sus solicitudes (as-is dashQPanel + ppPanel). La decisión se toma en el
 * módulo correspondiente; aquí solo se avisa y se enlaza.
 */
export function PanelAprobaciones({ datos }: { datos: DatosAprobaciones }) {
  const { descuentos, precios, respuestas } = datos;
  if (!descuentos.length && !precios.length && !respuestas.length) return null;

  return (
    <div className="space-y-3">
      {descuentos.length ? (
        <section className="space-y-2 rounded-[10px] border border-paramo-warn bg-paramo-surface p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Descuentos por aprobar
            </h2>
            <span className="text-xs text-paramo-muted">
              cotizaciones con más del {DESC_MAX}% de descuento
            </span>
          </div>
          <ul className="divide-y divide-paramo-line">
            {descuentos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-paramo-fg">
                    {d.numero} · {d.cliente}
                  </div>
                  <div className="text-xs text-paramo-muted">
                    {d.solicitante} solicita {d.descuento}%
                    {d.solicitado_en ? ` · ${fechaHora(d.solicitado_en)}` : ""}
                  </div>
                </div>
                <b className="text-paramo-fg">{formatCOP(d.total)}</b>
                <Link href="/cotizaciones" className={linkClass}>
                  Revisar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {precios.length ? (
        <section className="space-y-2 rounded-[10px] border border-paramo-warn bg-paramo-surface p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Precios por aprobar
            </h2>
            <span className="text-xs text-paramo-muted">
              propuestos por el vendedor; mientras no se aprueben, las cotizaciones usan la
              lista general
            </span>
          </div>
          <ul className="divide-y divide-paramo-line">
            {precios.map((p) => (
              <li
                key={`${p.producto_id}-${p.tipo}`}
                className="flex flex-wrap items-center gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-paramo-fg">
                    {p.producto} · {p.tipo}
                  </div>
                  <div className="text-xs text-paramo-muted">
                    propone {p.propuesta} · {p.por}
                    {p.en ? ` · ${fechaHora(p.en)}` : ""}
                  </div>
                </div>
                <Link href="/productos" className={linkClass}>
                  Revisar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {respuestas.length ? (
        <section className="space-y-2 rounded-[10px] border border-paramo-line bg-paramo-surface p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Respuestas del supervisor
            </h2>
            <span className="text-xs text-paramo-muted">
              descuentos aprobados o rechazados en tus cotizaciones
            </span>
          </div>
          <ul className="divide-y divide-paramo-line">
            {respuestas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-paramo-fg">
                    {r.numero} · {r.cliente}
                  </div>
                  <div className="text-xs text-paramo-muted">
                    {r.rechazada
                      ? `rechazó ${r.descuento}%`
                      : `aprobó ${r.descuento}%`}
                  </div>
                </div>
                <b className="text-paramo-fg">{formatCOP(r.total)}</b>
                <Link href="/cotizaciones" className={linkClass}>
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
