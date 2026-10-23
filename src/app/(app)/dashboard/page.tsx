import Link from "next/link";
import { BarChart } from "@/components/BarChart";
import { ObservacionesDashboard } from "@/components/ObservacionesDashboard";
import { PanelAprobaciones } from "@/components/PanelAprobaciones";
import { estadoProducto } from "@/config/productos";
import { cargarAprobaciones } from "@/lib/aprobaciones";
import { can } from "@/lib/can";
import { cargarDashboard, type DatosDashboard } from "@/lib/dashboard";
import { textoFecha } from "@/lib/fechas";
import { formatMoneyShort, todayBogota } from "@/lib/format";
import { requireModuleAccess } from "@/lib/permissions";
import { cargarTiposClientePrecio } from "@/lib/productos";
import {
  resumenSeguimientoProductos,
  type ResumenSeguimiento,
} from "@/lib/productos-seguimiento";
import { createServiceClient } from "@/lib/supabase-server";
import type { VentaResumenFila } from "@/lib/types/venta";
import { mesCorto, mesLargo } from "@/lib/ventas-periodo";

export const dynamic = "force-dynamic";

const COLOR_ETAPA: Record<string, string> = {
  prospecto: "bg-paramo-stage-1 text-paramo-fg",
  contactado: "bg-paramo-stage-2 text-paramo-fg",
  muestra: "bg-paramo-stage-3 text-paramo-brand-ink",
  propuesta: "bg-paramo-stage-4 text-paramo-brand-ink",
  negociacion: "bg-paramo-stage-5 text-paramo-brand-ink",
  ganado: "bg-paramo-leaf text-paramo-brand-ink",
};

const panelClass = "space-y-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2";
const linkClass =
  "text-sm font-bold text-paramo-teal-ink underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";

function Delta({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  const sube = valor >= 0;
  return (
    <span className={`font-bold ${sube ? "text-paramo-good" : "text-paramo-bad"}`}>
      {sube ? "▲" : "▼"} {Math.abs(valor).toFixed(0)}%
    </span>
  );
}

function Kpi({
  etiqueta,
  valor,
  children,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  children: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-paramo-surface p-4 ${
        alerta ? "border-paramo-bad" : "border-paramo-line"
      }`}
    >
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
        {etiqueta}
      </div>
      <div className="mt-1 font-paramo-display text-2xl font-bold text-paramo-fg">{valor}</div>
      <div className="text-xs text-paramo-muted">{children}</div>
    </div>
  );
}

/** Barras horizontales del «top» (as-is hl). */
function Top({ filas, total }: { filas: VentaResumenFila[]; total: number }) {
  if (!filas.length) return <p className="text-sm text-paramo-muted">Sin datos.</p>;
  const max = filas[0].valor || 1;
  return (
    <ul className="space-y-2">
      {filas.map((o) => (
        <li key={o.clave} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-paramo-fg" title={o.etiqueta}>
              {o.etiqueta}
            </span>
            <span className="shrink-0 font-bold text-paramo-fg">
              {formatMoneyShort(o.valor)}
              {total ? ` · ${Math.round((o.valor / total) * 100)}%` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-paramo-surface-2">
            <div
              className="h-full rounded-full bg-paramo-teal"
              style={{ width: `${(o.valor / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const ctx = await requireModuleAccess("dashboard");
  const service = createServiceClient();
  const rol = ctx.profile.rol;

  const tipos = await cargarTiposClientePrecio(service);
  const [datos, aprobaciones, resumenProductos] = await Promise.all([
    cargarDashboard(service, rol, ctx.userId),
    cargarAprobaciones(
      service,
      rol,
      ctx.userId,
      new Map((tipos ?? []).map((t) => [t.codigo, t.nombre])),
    ),
    resumenSeguimientoProductos(service),
  ]);

  const nombre = ctx.profile.nombre.trim().split(/\s+/)[0];
  const saludo = nombre ? `Hola, ${nombre}` : "Dashboard";
  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
  const puedeCrearCompromiso = can(rol, "editar") || can(rol, "asignar");
  const puedeCrearProspecto = can(rol, "editar") || can(rol, "asignar");

  const encabezado = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <header className="space-y-1">
        <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">{saludo}</h1>
        <p className="text-sm text-paramo-muted">{fecha}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {puedeCrearCompromiso ? (
          <Link href="/compromisos?nuevo=1" className={btnGhost}>
            Compromiso
          </Link>
        ) : null}
        {puedeCrearProspecto ? (
          <Link href="/prospectos" className={btnPrimary}>
            Prospecto
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (!datos) {
    return (
      <div className="space-y-4">
        {encabezado}
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudo cargar el resumen. Revisa que las migraciones estén aplicadas en Supabase.
        </p>
      </div>
    );
  }

  if (datos.vacio) {
    const ed = can(rol, "editar");
    return (
      <div className="space-y-4">
        {encabezado}
        <PanelAprobaciones datos={aprobaciones} />
        <section className="space-y-2 rounded-[10px] bg-paramo-brand-soft p-6">
          <h2 className="font-paramo-display text-xl font-bold text-paramo-fg">
            {ed ? "Tu CRM está listo" : "Aún no hay gestión registrada"}
          </h2>
          <p className="text-sm text-paramo-fg">
            {ed
              ? "Cuatro pasos para empezar. Lo que registres queda guardado y el Supervisor lo puede auditar."
              : "Cuando el comercial registre prospectos, compromisos y ventas, aquí verás el avance y en Supervisión la bitácora completa."}
          </p>
        </section>
        {ed ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Paso 1", "Carga el catálogo", "Las 21 referencias del sitio están listas para cargar con el seed. Luego agregas las nuevas.", "/productos", "Ir a productos"],
              ["Paso 2", "Registra un prospecto", "Solo el nombre de la empresa es obligatorio.", "/prospectos", "Nuevo prospecto"],
              ["Paso 3", "Agenda un compromiso", "Llamadas, visitas, muestras. Los vencidos aparecen en rojo.", "/compromisos?nuevo=1", "Nuevo compromiso"],
              ["Paso 4", "Carga las ventas", "Descarga la plantilla de Excel, llénala y súbela.", "/ventas", "Ir a ventas"],
            ].map(([n, t, d, href, cta]) => (
              <div key={n} className={panelClass}>
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                  {n}
                </span>
                <h3 className="font-paramo-display text-base font-bold text-paramo-fg">{t}</h3>
                <p className="text-sm text-paramo-muted">{d}</p>
                <Link href={href} className={btnGhost}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DashboardCompleto
      datos={datos}
      encabezado={encabezado}
      aprobaciones={aprobaciones}
      resumenProductos={resumenProductos}
      rol={rol}
      userId={ctx.userId}
    />
  );
}

function DashboardCompleto({
  datos,
  encabezado,
  aprobaciones,
  resumenProductos,
  rol,
  userId,
}: {
  datos: DatosDashboard;
  encabezado: React.ReactNode;
  aprobaciones: Awaited<ReturnType<typeof cargarAprobaciones>>;
  resumenProductos: Record<string, ResumenSeguimiento>;
  rol: "comercial" | "supervisor";
  userId: string;
}) {
  const d = datos;
  const hoy = todayBogota();
  const maxEtapa = Math.max(1, ...d.funnel.map((e) => e.cantidad));
  const cierres = d.ganados + d.perdidos;

  return (
    <div className="space-y-4">
      {encabezado}
      <PanelAprobaciones datos={aprobaciones} />
      {rol === "comercial" ? (
        <ObservacionesDashboard
          inicial={d.observacionesAbiertas}
          userId={userId}
          puedeAtender={can(rol, "editar")}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta={`Ventas ${d.ref ? mesLargo(d.ref) : "del mes"}`}
          valor={d.ref ? formatMoneyShort(d.ventasRef) : "—"}
        >
          {d.ref ? (
            d.prev ? (
              <>
                <Delta valor={d.cambioMes} /> vs {mesCorto(d.prev)}
              </>
            ) : (
              "primer mes cargado"
            )
          ) : (
            "Carga el Excel de ventas"
          )}
        </Kpi>
        <Kpi etiqueta={`Acumulado ${d.anioRef}`} valor={d.ref ? formatMoneyShort(d.acumulado) : "—"}>
          {d.cambioAnio !== null ? (
            <>
              <Delta valor={d.cambioAnio} /> vs mismo periodo {Number(d.anioRef) - 1}
            </>
          ) : (
            "sin año anterior para comparar"
          )}
        </Kpi>
        <Kpi etiqueta="Pipeline ponderado" valor={formatMoneyShort(d.pipelinePonderado)}>
          {d.prospectosActivos} prospectos activos · venta mensual × probabilidad
        </Kpi>
        <Kpi etiqueta="Compromisos vencidos" valor={String(d.vencidos)} alerta={d.vencidos > 0}>
          {d.vencidos ? (
            <Link href="/compromisos" className={linkClass}>
              Ver ahora →
            </Link>
          ) : (
            "Al día"
          )}
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={panelClass}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">Agenda</h2>
            <span className="text-xs text-paramo-muted">vencidos y próximos 7 días</span>
          </div>
          {d.agenda.length ? (
            <ul className="divide-y divide-paramo-line">
              {d.agenda.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-paramo-fg">{c.titulo}</div>
                    <div className="text-xs text-paramo-muted">
                      {c.tipo}
                      {c.prospecto_empresa ? ` · ${c.prospecto_empresa}` : ""}
                      {c.responsable_id !== userId || rol === "supervisor"
                        ? ` · ${c.responsable_nombre}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={`text-xs ${
                      c.fecha < hoy
                        ? "font-bold text-paramo-bad"
                        : c.fecha === hoy
                          ? "font-bold text-paramo-warn"
                          : "text-paramo-muted"
                    }`}
                  >
                    {textoFecha(c.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-paramo-muted">No hay compromisos para esta semana.</p>
          )}
          {d.agendaTotal > 8 ? (
            <Link href="/compromisos" className={linkClass}>
              Ver los {d.agendaTotal} →
            </Link>
          ) : null}
        </section>

        <section className={panelClass}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Funnel comercial
            </h2>
            <span className="text-xs text-paramo-muted">
              {cierres
                ? `tasa de cierre ${Math.round((d.ganados / cierres) * 100)}% (${d.ganados} ganados / ${d.perdidos} perdidos)`
                : "aún sin cierres"}
            </span>
            <Link href="/funnel" className={linkClass}>
              Abrir →
            </Link>
          </div>
          <ul className="space-y-2">
            {d.funnel.map((e) => (
              <li key={e.codigo} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="truncate text-paramo-fg">{e.nombre}</span>
                <div className="h-6 rounded bg-paramo-surface-2">
                  <div
                    className={`flex h-full items-center rounded px-2 text-xs font-bold ${COLOR_ETAPA[e.codigo] ?? "bg-paramo-muted text-paramo-brand-ink"}`}
                    style={{ width: `${Math.max(6, (e.cantidad / maxEtapa) * 100)}%` }}
                  >
                    {e.cantidad}
                  </div>
                </div>
                <span className="text-xs font-bold text-paramo-fg">{formatMoneyShort(e.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={panelClass}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
            Ventas mensuales
          </h2>
          <span className="text-xs text-paramo-muted">
            COP, últimos {d.serie12.length || 12} meses cargados
          </span>
          <Link href="/ventas" className={linkClass}>
            Detalle →
          </Link>
        </div>
        {d.serie12.length ? (
          <BarChart
            data={d.serie12.map((m) => ({ l: mesCorto(m.mes), v: m.valor }))}
            label="Ventas mensuales"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3 py-2 text-sm text-paramo-muted">
            <span>Sin ventas cargadas.</span>
            {can(rol, "editar") ? (
              <Link href="/ventas" className={btnGhost}>
                Cargar Excel
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {d.ref ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={panelClass}>
            <div className="flex items-baseline gap-2">
              <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                Top clientes
              </h2>
              <span className="text-xs text-paramo-muted">{mesLargo(d.ref)}</span>
            </div>
            <Top filas={d.topClientes} total={d.ventasRef} />
          </section>
          <section className={panelClass}>
            <div className="flex items-baseline gap-2">
              <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                Top productos
              </h2>
              <span className="text-xs text-paramo-muted">{mesLargo(d.ref)}</span>
            </div>
            <Top filas={d.topProductos} total={d.ventasRef} />
          </section>
          <section className={panelClass}>
            <div className="flex items-baseline gap-2">
              <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                Mix por canal
              </h2>
              <span className="text-xs text-paramo-muted">{mesLargo(d.ref)}</span>
            </div>
            <Top filas={d.mixCanal} total={d.ventasRef} />
          </section>
        </div>
      ) : null}

      <div className={`grid gap-4 ${d.lanzamientos.length ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <section className={panelClass}>
          <div className="flex items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Prospectos sin contacto
            </h2>
            <span className="text-xs text-paramo-muted">14+ días sin actividad</span>
          </div>
          {d.sinContacto.length ? (
            <ul className="divide-y divide-paramo-line">
              {d.sinContacto.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/prospectos?abrir=${p.id}`}
                      className="block truncate font-medium text-paramo-teal-ink hover:underline"
                    >
                      {p.empresa}
                    </Link>
                    <div className="text-xs text-paramo-muted">
                      {p.etapa} · {formatMoneyShort(p.valor)}/mes
                    </div>
                  </div>
                  <span className="text-xs font-bold text-paramo-bad">{p.dias} días</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paramo-muted">
              Todos los prospectos activos tienen contacto reciente.
            </p>
          )}
        </section>

        <section className={panelClass}>
          <div className="flex items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Clientes que dejaron de comprar
            </h2>
            <span className="text-xs text-paramo-muted">
              compraron en los 3 meses previos, no en {d.ref ? mesLargo(d.ref) : "el último mes"}
            </span>
          </div>
          {d.clientesPerdidos.length ? (
            <ul className="divide-y divide-paramo-line">
              {d.clientesPerdidos.slice(0, 6).map((c) => (
                <li key={c.cliente} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-paramo-fg">{c.cliente}</div>
                    <div className="text-xs text-paramo-muted">
                      última compra {c.ultimaCompra ? mesCorto(c.ultimaCompra) : "—"}
                    </div>
                  </div>
                  <span className="text-xs text-paramo-muted">
                    {formatMoneyShort(c.promedio)}/mes
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paramo-muted">
              {d.hayDosMeses
                ? "Ningún cliente recurrente dejó de comprar."
                : "Necesitas al menos dos meses cargados."}
            </p>
          )}
        </section>

        {d.lanzamientos.length ? (
          <section className={panelClass}>
            <div className="flex items-baseline gap-2">
              <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                Productos nuevos
              </h2>
              <span className="text-xs text-paramo-muted">en desarrollo y lanzamiento</span>
              <Link href="/productos" className={linkClass}>
                Ver →
              </Link>
            </div>
            <ul className="divide-y divide-paramo-line">
              {d.lanzamientos.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/productos?abrir=${p.id}`}
                      className="block truncate font-medium text-paramo-teal-ink hover:underline"
                    >
                      {p.nombre}
                    </Link>
                    <div className="text-xs text-paramo-muted">
                      {estadoProducto(p.estado).nombre} · {resumenProductos[p.id]?.interesados ?? 0}{" "}
                      interesados
                    </div>
                  </div>
                  <span className="text-xs text-paramo-olive">
                    {resumenProductos[p.id]?.promedio
                      ? `${resumenProductos[p.id].promedio.toFixed(1)} ★`
                      : <span className="text-paramo-muted">sin calificar</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
