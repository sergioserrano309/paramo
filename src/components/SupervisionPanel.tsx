"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PCT_MAX_LISTA_GENERAL, TIPO_CLIENTE_PVP } from "@/config/productos";
import { BarChart } from "@/components/BarChart";
import {
  NuevaObservacionModal,
  ObservacionesLista,
} from "@/components/ObservacionesLista";
import type { EventoBitacora } from "@/lib/bitacora-consulta";
import { fechaCorta, textoFecha } from "@/lib/fechas";
import { formatMoneyShort, localDayBogota } from "@/lib/format";
import type { DatosSupervision } from "@/lib/supervision";
import type { ObservacionItem } from "@/lib/types/observacion";
import type { TipoClientePrecio } from "@/lib/types/producto";

type Props = {
  dias: number;
  periodos: number[];
  datos: DatosSupervision | null;
  observaciones: ObservacionItem[];
  eventosIniciales: EventoBitacora[];
  acciones: string[];
  tiposCliente: TipoClientePrecio[];
  prospectos: Array<{ id: string; empresa: string }>;
  userId: string;
  puedeObservar: boolean;
  puedeAtender: boolean;
  puedeEditarPrecios: boolean;
  aprobaciones: ReactNode;
};

const fieldClass =
  "min-h-11 rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-paramo-line px-3 text-xs font-bold text-paramo-fg hover:bg-paramo-surface-2";
const panelClass = "space-y-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4";

/** Como el as-is: el detalle abre la ficha del prospecto, producto o cotización que lo originó. */
function enlaceDeEvento(e: EventoBitacora): string | null {
  if (!e.ref_id) return null;
  if (e.ref_tabla === "prospectos") return `/prospectos?abrir=${e.ref_id}`;
  if (e.ref_tabla === "productos") return `/productos?abrir=${e.ref_id}`;
  if (e.ref_tabla === "cotizaciones") return `/cotizaciones?abrir=${e.ref_id}`;
  return null;
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${fechaCorta(localDayBogota(iso))} · ${d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function SupervisionPanel({
  dias,
  periodos,
  datos,
  observaciones: obsIniciales,
  eventosIniciales,
  acciones,
  tiposCliente,
  prospectos,
  userId,
  puedeObservar,
  puedeAtender,
  puedeEditarPrecios,
  aprobaciones,
}: Props) {
  const [observaciones, setObservaciones] = useState(obsIniciales);
  const [modalObs, setModalObs] = useState<{ prospectoId?: string } | null>(null);

  const [eventos, setEventos] = useState(eventosIniciales);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [errorBit, setErrorBit] = useState<string | null>(null);
  const primeraVez = useRef(true);

  const editables = tiposCliente.filter((t) => t.codigo !== TIPO_CLIENTE_PVP);
  const [descuentos, setDescuentos] = useState<Record<string, string>>(() =>
    Object.fromEntries(editables.map((t) => [t.codigo, String(t.descuento_pct)])),
  );
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);
  const [avisoPrecios, setAvisoPrecios] = useState<string | null>(null);
  const [errorPrecios, setErrorPrecios] = useState<string | null>(null);

  // Bitácora: se consulta de nuevo (con una pequeña espera al escribir) al cambiar filtros.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setErrorBit(null);
      try {
        const sp = new URLSearchParams();
        if (filtroRol) sp.set("rol", filtroRol);
        if (filtroAccion) sp.set("accion", filtroAccion);
        if (filtroTexto.trim()) sp.set("q", filtroTexto.trim());
        const res = await fetch(`/api/bitacora?${sp.toString()}`);
        const json = (await res.json().catch(() => null)) as {
          eventos?: EventoBitacora[];
          error?: string;
        } | null;
        if (!res.ok || !json?.eventos) throw new Error(json?.error ?? "No se pudo cargar la bitácora.");
        setEventos(json.eventos);
      } catch (e) {
        setErrorBit(e instanceof Error ? e.message : "No se pudo cargar la bitácora.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [filtroRol, filtroAccion, filtroTexto]);

  async function guardarPrecios(e: FormEvent) {
    e.preventDefault();
    setGuardandoPrecios(true);
    setAvisoPrecios(null);
    setErrorPrecios(null);
    try {
      const res = await fetch("/api/config/precios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descuentos: Object.fromEntries(
            Object.entries(descuentos).map(([k, v]) => [k, Number(v) || 0]),
          ),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        descuentos?: Record<string, number>;
        error?: string;
      } | null;
      if (!res.ok || !json?.descuentos) {
        throw new Error(json?.error ?? "No se pudieron guardar las listas de precios.");
      }
      setDescuentos(Object.fromEntries(Object.entries(json.descuentos).map(([k, v]) => [k, String(v)])));
      setAvisoPrecios("Listas de precios guardadas.");
    } catch (err) {
      setErrorPrecios(
        err instanceof Error ? err.message : "No se pudieron guardar las listas de precios.",
      );
    } finally {
      setGuardandoPrecios(false);
    }
  }

  const k = datos?.kpis;
  const abiertas = observaciones.filter((o) => o.estado === "abierta").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">Supervisión</h1>
          <p className="text-sm text-paramo-muted">Auditoría de la labor comercial</p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Período"
            className="inline-flex gap-1 rounded-full border border-paramo-line bg-paramo-surface p-1"
          >
            {periodos.map((p) => (
              <Link
                key={p}
                href={`/supervision?dias=${p}`}
                aria-current={dias === p ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold ${
                  dias === p
                    ? "bg-paramo-brand text-paramo-brand-ink"
                    : "text-paramo-muted hover:bg-paramo-surface-2"
                }`}
              >
                {p} días
              </Link>
            ))}
          </div>
          <Link href="/compromisos?nuevo=1" className={btnPrimary}>
            Asignar tarea
          </Link>
        </div>
      </div>

      {aprobaciones}

      {!datos || !k ? (
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudieron cargar los indicadores. Revisa que las migraciones estén aplicadas en
          Supabase.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi
              etiqueta="Contactos con clientes"
              valor={String(k.contactos)}
              pie={`llamadas, visitas, correos · ${k.empresasContactadas} empresas`}
            />
            <Kpi
              etiqueta="Prospectos nuevos"
              valor={String(k.prospectosNuevos)}
              pie={
                k.prospectosNuevos
                  ? `${formatMoneyShort(k.valorNuevos)}/mes potencial`
                  : "ninguno en el período"
              }
            />
            <Kpi
              etiqueta="Avances en el funnel"
              valor={String(k.avancesFunnel)}
              pie={`${k.ganados} ${k.ganados === 1 ? "negocio ganado" : "negocios ganados"}`}
            />
            <Kpi
              etiqueta="Compromisos cumplidos"
              valor={k.comprometidos ? `${k.cumplidos}/${k.comprometidos}` : "—"}
              pie={
                k.comprometidos
                  ? `${Math.round((k.cumplidos / k.comprometidos) * 100)}% cumplidos · ${k.aTiempo} a tiempo`
                  : "sin compromisos con fecha en el período"
              }
            />
            <Kpi
              etiqueta="Compromisos vencidos hoy"
              valor={String(k.vencidosHoy)}
              pie={k.vencidosHoy ? "pendientes con fecha pasada" : "al día"}
              alerta={k.vencidosHoy > 0}
            />
            <Kpi
              etiqueta="Último registro del comercial"
              valor={k.ultimoRegistro ? textoFecha(localDayBogota(k.ultimoRegistro.en)) : "—"}
              pie={
                k.ultimoRegistro
                  ? `${k.ultimoRegistro.accion}${k.ultimoIngreso ? ` · último ingreso ${fechaHora(k.ultimoIngreso)}` : ""}`
                  : "sin registros todavía"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={panelClass}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                  Actividad diaria del comercial
                </h2>
                <span className="text-xs text-paramo-muted">
                  acciones registradas en el CRM, últimos 14 días
                </span>
              </div>
              <BarChart
                data={datos.actividad.map((d) => ({ l: fechaCorta(d.dia).split(" ")[0], v: d.n }))}
                money={false}
                label="Actividad diaria"
                H={230}
                W={560}
              />
            </section>

            <section className={panelClass}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto">
                  <h2 className="font-paramo-display text-lg font-bold text-paramo-fg">
                    Observaciones
                  </h2>
                  <span className="text-xs text-paramo-muted">
                    {abiertas} abiertas · {observaciones.length - abiertas} atendidas
                  </span>
                </div>
                {puedeObservar ? (
                  <button type="button" className={btnPrimary} onClick={() => setModalObs({})}>
                    Observación
                  </button>
                ) : null}
              </div>
              <ObservacionesLista
                observaciones={observaciones.slice(0, 8)}
                userId={userId}
                puedeAtender={puedeAtender}
                puedeObservar={puedeObservar}
                onActualizada={(o) =>
                  setObservaciones((prev) => prev.map((x) => (x.id === o.id ? o : x)))
                }
                onRetirada={(id) => setObservaciones((prev) => prev.filter((x) => x.id !== id))}
              />
            </section>
          </div>

          <section className={panelClass}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
                Cartera bajo seguimiento
              </h2>
              <span className="text-xs text-paramo-muted">
                prospectos activos; primero los que no tienen próximo paso o llevan más tiempo sin
                contacto
              </span>
            </div>
            {datos.cartera.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                      <th className="px-3 py-2">Empresa</th>
                      <th className="px-3 py-2">Etapa</th>
                      <th className="px-3 py-2 text-right">Valor/mes</th>
                      <th className="px-3 py-2 text-right">Sin contacto</th>
                      <th className="px-3 py-2 text-right">Contactos ({dias} d)</th>
                      <th className="px-3 py-2">Próximo paso</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {datos.cartera.map((p) => (
                      <tr key={p.id} className="border-b border-paramo-line last:border-b-0">
                        <td className="px-3 py-2 font-bold text-paramo-fg">
                          {p.empresa}
                          {p.observacionesAbiertas ? (
                            <span className="ml-2 rounded-full bg-paramo-brand-soft px-2 py-0.5 text-[10px] font-bold text-paramo-brand">
                              {p.observacionesAbiertas}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{p.etapa}</td>
                        <td className="px-3 py-2 text-right">
                          {p.valor ? formatMoneyShort(p.valor) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${
                            p.diasSinContacto >= 14 ? "font-bold text-paramo-bad" : ""
                          }`}
                        >
                          {p.diasSinContacto} d
                        </td>
                        <td className="px-3 py-2 text-right">{p.contactos}</td>
                        <td className="px-3 py-2">
                          {p.proximo ? (
                            <>
                              <span className="font-bold">{textoFecha(p.proximo.fecha)}</span>{" "}
                              <span className="text-xs text-paramo-muted">{p.proximo.titulo}</span>
                            </>
                          ) : (
                            <span className="font-bold text-paramo-bad">Sin próximo paso</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {puedeObservar ? (
                            <button
                              type="button"
                              className={btnSmall}
                              onClick={() => setModalObs({ prospectoId: p.id })}
                            >
                              Observar
                            </button>
                          ) : null}{" "}
                          <Link
                            href={`/compromisos?nuevo=1&prospecto=${p.id}`}
                            className={`${btnSmall} border-transparent text-paramo-muted`}
                          >
                            Asignar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-paramo-muted">No hay prospectos activos.</p>
            )}
          </section>
        </>
      )}

      <section className={panelClass}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
            Listas de precios
          </h2>
          <span className="text-xs text-paramo-muted">
            descuento sobre el PVP por tipo de cliente; lo usan las cotizaciones cuando el
            producto no tiene precio especial
          </span>
        </div>
        <form onSubmit={guardarPrecios} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" autoComplete="off">
          <fieldset disabled={!puedeEditarPrecios} className="contents">
            {editables.map((t) => (
              <div key={t.codigo} className="space-y-1">
                <label htmlFor={`pct-${t.codigo}`} className="text-[11.5px] font-bold text-paramo-muted">
                  {t.nombre}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`pct-${t.codigo}`}
                    type="number"
                    min={0}
                    max={PCT_MAX_LISTA_GENERAL}
                    step={0.5}
                    value={descuentos[t.codigo] ?? ""}
                    onChange={(e) => setDescuentos((s) => ({ ...s, [t.codigo]: e.target.value }))}
                    className={`${fieldClass} w-full`}
                  />
                  <span className="text-xs text-paramo-muted">%</span>
                </div>
              </div>
            ))}
            {puedeEditarPrecios ? (
              <div className="flex items-center justify-end gap-3 sm:col-span-2 lg:col-span-3">
                {avisoPrecios ? (
                  <span className="mr-auto text-sm text-paramo-good" role="status">
                    {avisoPrecios}
                  </span>
                ) : null}
                {errorPrecios ? (
                  <span className="mr-auto text-sm text-paramo-bad" role="alert">
                    {errorPrecios}
                  </span>
                ) : null}
                <button type="submit" disabled={guardandoPrecios} className={btnPrimary}>
                  {guardandoPrecios ? "Guardando…" : "Guardar listas"}
                </button>
              </div>
            ) : null}
          </fieldset>
        </form>
        <p className="text-xs text-paramo-muted">
          Valores iniciales de referencia: reemplázalos por la política comercial real de Páramo.
          Consumidor final paga el PVP.
        </p>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">Bitácora</h2>
          <span className="text-xs text-paramo-muted">
            cada acción registrada en el CRM, con usuario, fecha y hora
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Usuario"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            className={fieldClass}
          >
            <option value="">Todos los usuarios</option>
            <option value="comercial">Comercial</option>
            <option value="supervisor">Supervisor</option>
          </select>
          <select
            aria-label="Acción"
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
            className={fieldClass}
          >
            <option value="">Todas las acciones</option>
            {acciones.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Buscar en el detalle"
            placeholder="Buscar en el detalle…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className={`${fieldClass} min-w-[180px] flex-1`}
          />
          <span className="text-xs text-paramo-muted">{eventos.length} registros</span>
        </div>
        {errorBit ? (
          <p className="text-sm text-paramo-bad" role="alert">
            {errorBit}
          </p>
        ) : null}
        {eventos.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                  <th className="px-3 py-2">Fecha y hora</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b border-paramo-line last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-paramo-muted">
                      {fechaHora(e.ocurrido_en)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-paramo-line px-2 py-0.5 text-xs font-bold">
                        <i
                          className={`inline-block size-2 rounded-full ${
                            e.rol === "supervisor" ? "bg-paramo-brand" : "bg-paramo-teal"
                          }`}
                          aria-hidden="true"
                        />
                        {e.actor_nombre}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-paramo-fg">
                      {e.accion}
                    </td>
                    <td className="px-3 py-2 text-paramo-fg">
                      {enlaceDeEvento(e) ? (
                        <Link
                          href={enlaceDeEvento(e) as string}
                          className="font-medium text-paramo-teal-ink underline-offset-2 hover:underline"
                        >
                          {e.detalle}
                        </Link>
                      ) : (
                        e.detalle
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-paramo-muted">Aún no hay registros.</p>
        )}
        {eventos.length >= 200 ? (
          <p className="text-xs text-paramo-muted">Se muestran los 200 más recientes.</p>
        ) : null}
      </section>

      {modalObs ? (
        <NuevaObservacionModal
          prospectos={prospectos}
          prospectoInicial={modalObs.prospectoId}
          onCerrar={() => setModalObs(null)}
          onCreada={(o) => {
            setObservaciones((prev) => [o, ...prev]);
            setModalObs(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  pie,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  pie: string;
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
      <div className="text-xs text-paramo-muted">{pie}</div>
    </div>
  );
}
