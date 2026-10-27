"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { estadoCotizacion } from "@/config/cotizaciones";
import { formatCOP } from "@/lib/precios";
import type { CotizacionResumen, ProductoInteres } from "@/lib/types/ficha";
import { TIPOS_ACTIVIDAD } from "@/lib/actividad";
import { CALIF_TXT } from "@/config/calificacion";
import { MOTIVOS_INACTIVO } from "@/config/motivos-inactivo";
import {
  ATAJOS_FECHA_COMPROMISO,
  TIPOS_COMPROMISO,
} from "@/config/compromisos";
import { ROL_LABEL, type Rol } from "@/config/roles";
import { can, canAsignarResponsable, canCreateCompromiso } from "@/lib/can";
import { cn } from "@/lib/cn";
import {
  addDaysYmd,
  formatDateCompact,
  localDayBogota,
  todayBogota,
} from "@/lib/format";
import type { CompromisoAgendaItem } from "@/lib/types/compromiso";
import type {
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
} from "@/lib/types/prospecto";

const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const secClass =
  "text-[11px] font-extrabold uppercase tracking-[0.09em] text-paramo-muted";
const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const btnPri =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-4 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line bg-paramo-surface px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:opacity-60";

type ObservacionItem = {
  id: string;
  texto: string;
  estado: "abierta" | "atendida";
  respuesta: string;
  autor_id: string | null;
  autor_nombre: string;
  atendida_en: string | null;
  creado_en: string;
};

type DatosForm = {
  empresa: string;
  nit: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  ciudad: string;
  canal_codigo: string;
  tipo_cliente_codigo: string;
  fuente_codigo: string;
  valor: string;
  notas: string;
};

type ProspectoDetalleDrawerProps = {
  titleId: string;
  prospecto: ProspectoListItem;
  etapas: EtapaCatalogo[];
  etapaIndex: Map<string, number>;
  catalogos: ProspectosCatalogos;
  prospectosAgenda: ProspectoListItem[];
  userId: string;
  userRol: Rol;
  canMove: boolean;
  moving: boolean;
  onClose: () => void;
  onSetStage: (codigo: string) => void;
  onUpdated: (prospecto: ProspectoListItem) => void;
  onDeleted: (id: string) => void;
  onCompromisoCreado?: (compromiso: CompromisoAgendaItem) => void;
};

function datosFrom(p: ProspectoListItem): DatosForm {
  return {
    empresa: p.empresa,
    nit: p.nit,
    contacto: p.contacto,
    cargo: p.cargo,
    telefono: p.telefono,
    email: p.email,
    ciudad: p.ciudad,
    canal_codigo: p.canal_codigo ?? "",
    tipo_cliente_codigo: p.tipo_cliente_codigo ?? "",
    fuente_codigo: p.fuente_codigo ?? "",
    valor: String(p.valor_mensual_estimado || 0),
    notas: p.notas,
  };
}

function formatObsCuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProspectoDetalleDrawer({
  titleId,
  prospecto: p,
  etapas,
  etapaIndex,
  catalogos,
  prospectosAgenda,
  userId,
  userRol,
  canMove,
  moving,
  onClose,
  onSetStage,
  onUpdated,
  onDeleted,
  onCompromisoCreado,
}: ProspectoDetalleDrawerProps) {
  const router = useRouter();
  const ci = etapaIndex.get(p.etapa_codigo) ?? 0;
  const canEdit = canMove;
  const canAssign = canAsignarResponsable(userRol, userId, p.responsable_id);
  const puedeObservar = can(userRol, "observar");
  const puedeResponder = can(userRol, "editar");
  const puedeAgendar = canCreateCompromiso(userRol) && p.activo;
  const [form, setForm] = useState(() => datosFrom(p));
  const [observaciones, setObservaciones] = useState<ObservacionItem[]>([]);
  const [compromisos, setCompromisos] = useState<CompromisoAgendaItem[]>([]);
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([]);
  const [productos, setProductos] = useState<ProductoInteres[]>([]);
  const [confirmInact, setConfirmInact] = useState(false);
  const [motivoInact, setMotivoInact] = useState<string>(MOTIVOS_INACTIVO[0]);
  const [obsOpen, setObsOpen] = useState(false);
  const [obsTexto, setObsTexto] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [actTipo, setActTipo] = useState<string>(TIPOS_ACTIVIDAD[0]);
  const [actTexto, setActTexto] = useState("");
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(datosFrom(p));
    setConfirmInact(false);
    setConfirmDelete(false);
    setAgendaOpen(false);
    // Solo al abrir otro prospecto. Si el efecto depende de `p` entero,
    // un cambio de etapa o actividad pisaría lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !agendaOpen && !obsOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agendaOpen, obsOpen, onClose]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [obsRes, compRes, relRes] = await Promise.all([
        fetch(`/api/prospectos/${p.id}/observaciones`),
        fetch(`/api/compromisos?prospecto_id=${p.id}`),
        fetch(`/api/prospectos/${p.id}/relacionados`),
      ]);
      const obsBody = (await obsRes.json().catch(() => null)) as {
        observaciones?: ObservacionItem[];
      } | null;
      const compBody = (await compRes.json().catch(() => null)) as {
        compromisos?: CompromisoAgendaItem[];
      } | null;
      const relBody = (await relRes.json().catch(() => null)) as {
        cotizaciones?: CotizacionResumen[];
        productos?: ProductoInteres[];
      } | null;
      if (cancel) return;
      setObservaciones(obsBody?.observaciones ?? []);
      setCompromisos(compBody?.compromisos ?? []);
      setCotizaciones(relBody?.cotizaciones ?? []);
      setProductos(relBody?.productos ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [p.id]);

  async function patchProspecto(body: Record<string, unknown>) {
    const res = await fetch(`/api/prospectos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      prospecto?: ProspectoListItem;
    } | null;
    if (!res.ok || !data?.prospecto) {
      throw new Error(data?.error ?? "No se pudo guardar el prospecto.");
    }
    onUpdated(data.prospecto);
    setForm(datosFrom(data.prospecto));
    router.refresh();
    return data.prospecto;
  }

  /** Marca o quita un producto de interés (la ruta devuelve la ficha ya actualizada). */
  async function toggleInteres(productoId: string, interesado: boolean) {
    const res = await fetch(`/api/prospectos/${p.id}/interes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: productoId, interesado }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      ficha?: { productos: ProductoInteres[] };
    } | null;
    if (!res.ok || !data?.ficha) {
      throw new Error(data?.error ?? "No se pudo actualizar el producto de interés.");
    }
    setProductos(data.ficha.productos);
  }

  async function run(task: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const showObs = observaciones.length > 0 || puedeObservar;
  const historial = [...p.actividad].reverse();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-paramo-fg/40"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-xl flex-col border-l border-paramo-line bg-paramo-bg shadow-lg"
      >
        <div className="sticky top-0 z-[2] flex items-start gap-3 border-b border-paramo-line bg-paramo-surface px-4 py-3">
          <div className="mr-auto min-w-0">
            <h2
              id={titleId}
              className="font-paramo-display text-xl font-bold text-paramo-fg"
            >
              {p.empresa}
            </h2>
            <p className="text-xs text-paramo-muted">
              Creado {formatDateCompact(localDayBogota(p.creado_en))}
              {p.creado_por_nombre ? ` por ${p.creado_por_nombre}` : ""}
              {p.etapa_desde
                ? ` · en esta etapa desde ${formatDateCompact(p.etapa_desde)}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-paramo-bad" role="alert">
              {error}
            </p>
          ) : null}
          {!p.activo ? (
            <p className="rounded-lg border border-paramo-line border-l-4 border-l-paramo-muted bg-paramo-surface px-3 py-2 text-sm text-paramo-fg">
              <b>Prospecto inactivo</b>
              {p.inactivo_en
                ? ` desde ${formatDateCompact(p.inactivo_en)}`
                : ""}
              {p.motivo_inactivo ? ` · ${p.motivo_inactivo}` : ""}. No aparece
              en el funnel ni en los indicadores.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-4">
            <div>
              <div className={secClass}>Calificación</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex" role="group" aria-label="Calificación">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!canEdit || busy}
                      aria-label={`${n} de 3: ${CALIF_TXT[n]}`}
                      onClick={() =>
                        void run(() =>
                          patchProspecto({
                            accion: "calificacion",
                            calificacion: p.calificacion === n ? 0 : n,
                          }),
                        )
                      }
                      className={cn(
                        "inline-flex h-11 w-9 items-center justify-center text-xl",
                        n <= p.calificacion
                          ? "text-paramo-olive"
                          : "text-paramo-line",
                        !canEdit && "cursor-default",
                      )}
                    >
                      ★
                    </button>
                  ))}
                </span>
                <span className="text-xs text-paramo-muted">
                  {CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
                </span>
              </div>
            </div>
            <div className="min-w-[180px] flex-1">
              <div className={secClass}>Responsable</div>
              {canAssign ? (
                <select
                  aria-label="Responsable"
                  value={p.responsable_id}
                  disabled={busy}
                  onChange={(e) =>
                    void run(() =>
                      patchProspecto({
                        accion: "responsable",
                        responsable_id: e.target.value,
                      }),
                    )
                  }
                  className={cn(fieldClass, "mt-1")}
                >
                  {catalogos.responsables.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                      {r.id === userId ? " (yo)" : ""} · {ROL_LABEL[r.rol]}
                    </option>
                  ))}
                  {catalogos.responsables.some((r) => r.id === p.responsable_id)
                    ? null
                    : (
                      <option value={p.responsable_id}>
                        {p.responsable_nombre}
                      </option>
                    )}
                </select>
              ) : (
                <p className="mt-2 text-sm font-semibold text-paramo-fg">
                  {p.responsable_nombre}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className={secClass}>Etapa del funnel</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {etapas.map((s, i) => {
                const isCur = s.codigo === p.etapa_codigo;
                const isPast =
                  p.etapa_codigo !== "perdido" &&
                  i < ci &&
                  s.codigo !== "perdido";
                const enabled = canMove && p.activo && !moving && !busy;
                return (
                  <button
                    key={s.codigo}
                    type="button"
                    disabled={!enabled || isCur}
                    onClick={() => onSetStage(s.codigo)}
                    className={cn(
                      "min-h-10 flex-1 basis-[7rem] rounded-lg border px-2 py-1.5 text-xs font-bold",
                      isCur &&
                        s.codigo === "ganado" &&
                        "border-paramo-leaf bg-paramo-leaf text-white",
                      isCur &&
                        s.codigo === "perdido" &&
                        "border-paramo-rasp bg-paramo-rasp text-white",
                      isCur &&
                        s.codigo !== "ganado" &&
                        s.codigo !== "perdido" &&
                        "border-paramo-teal bg-paramo-teal text-white",
                      !isCur &&
                        isPast &&
                        "border-transparent bg-paramo-teal-soft text-paramo-teal-ink",
                      !isCur &&
                        !isPast &&
                        "border-paramo-line bg-paramo-surface text-paramo-muted",
                      enabled && !isCur
                        ? "cursor-pointer hover:border-paramo-teal"
                        : "cursor-default",
                      !enabled && "opacity-80",
                    )}
                  >
                    {s.nombre}
                  </button>
                );
              })}
            </div>
            {p.etapa_codigo === "perdido" && p.motivo_perdida ? (
              <p className="mt-2 text-xs text-paramo-muted">
                Motivo: {p.motivo_perdida}
              </p>
            ) : null}
            {canEdit ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!p.activo ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await patchProspecto({ accion: "reactivar" });
                        })
                      }
                      className="inline-flex min-h-11 items-center rounded-full bg-paramo-teal px-4 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                    >
                      Reactivar prospecto
                    </button>
                    <span className="text-xs text-paramo-muted">
                      Vuelve al funnel en la etapa {p.etapa_nombre}.
                    </span>
                  </>
                ) : confirmInact ? (
                  <>
                    <label className="text-xs text-paramo-muted" htmlFor="inact-why">
                      Motivo
                    </label>
                    <select
                      id="inact-why"
                      value={motivoInact}
                      onChange={(e) => setMotivoInact(e.target.value)}
                      className="min-h-11 rounded-lg border border-paramo-line bg-paramo-surface px-2 text-sm"
                    >
                      {MOTIVOS_INACTIVO.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await patchProspecto({
                            accion: "inactivar",
                            motivo: motivoInact,
                          });
                          setConfirmInact(false);
                        })
                      }
                      className={btnGhost}
                    >
                      Confirmar inactivación
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmInact(false)}
                      className={btnGhost}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmInact(true)}
                      className={btnGhost}
                    >
                      Inactivar prospecto
                    </button>
                    <span className="text-xs text-paramo-muted">
                      Sale del funnel y de los indicadores; no se borra.
                    </span>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {showObs ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={secClass}>Observaciones del supervisor</span>
                {puedeObservar ? (
                  <button type="button" onClick={() => setObsOpen(true)} className={btnPri}>
                    + Observación
                  </button>
                ) : null}
              </div>
              {observaciones.length === 0 ? (
                <p className="text-sm text-paramo-muted">Sin observaciones.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {observaciones.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-r-lg border-l-4 border-paramo-brand bg-paramo-brand-soft px-3 py-2"
                    >
                      <p className="text-sm text-paramo-fg">{o.texto}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
                        <span>
                          {o.autor_nombre} · {formatObsCuando(o.creado_en)}
                        </span>
                        <span className="rounded-full border border-paramo-brand/40 bg-paramo-surface px-2 py-0.5 font-bold text-paramo-brand">
                          {o.estado === "atendida" ? "Atendida" : "Abierta"}
                        </span>
                      </p>
                      {o.estado === "atendida" && o.respuesta ? (
                        <p className="mt-1 text-sm text-paramo-fg">
                          <b>Respuesta:</b> {o.respuesta}
                        </p>
                      ) : null}
                      {o.estado === "abierta" && puedeResponder ? (
                        replyId === o.id ? (
                          <form
                            className="mt-2 flex flex-wrap gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void run(async () => {
                                const res = await fetch(
                                  `/api/prospectos/${p.id}/observaciones/${o.id}`,
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ respuesta: replyText.trim() }),
                                  },
                                );
                                if (!res.ok) {
                                  throw new Error("No se pudo guardar la observación.");
                                }
                                setObservaciones((prev) =>
                                  prev.map((item) =>
                                    item.id === o.id
                                      ? {
                                          ...item,
                                          estado: "atendida",
                                          respuesta: replyText.trim(),
                                          atendida_en: new Date().toISOString(),
                                        }
                                      : item,
                                  ),
                                );
                                setReplyId(null);
                                setReplyText("");
                              });
                            }}
                          >
                            <input
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="¿Qué hiciste? (opcional)"
                              className={cn(fieldClass, "min-w-[12rem] flex-1")}
                            />
                            <button type="submit" className={btnPri} disabled={busy}>
                              Marcar atendida
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => setReplyId(null)}
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className={cn(btnGhost, "mt-2")}
                            onClick={() => {
                              setReplyId(o.id);
                              setReplyText("");
                            }}
                          >
                            Responder y marcar atendida
                          </button>
                        )
                      ) : null}
                      {o.estado === "abierta" &&
                      puedeObservar &&
                      o.autor_id === userId ? (
                        <button
                          type="button"
                          className="mt-2 text-sm font-bold text-paramo-muted hover:text-paramo-fg"
                          onClick={() =>
                            void run(async () => {
                              const res = await fetch(
                                `/api/prospectos/${p.id}/observaciones/${o.id}`,
                                { method: "DELETE" },
                              );
                              if (!res.ok) {
                                throw new Error("No se pudo retirar la observación.");
                              }
                              setObservaciones((prev) =>
                                prev.filter((item) => item.id !== o.id),
                              );
                            })
                          }
                        >
                          Retirar observación
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {canEdit && p.activo ? (
            <form
              className="rounded-[10px] border border-paramo-line bg-paramo-surface p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!actTexto.trim()) return;
                void run(async () => {
                  await patchProspecto({
                    accion: "actividad",
                    tipo: actTipo,
                    texto: actTexto.trim(),
                  });
                  setActTexto("");
                });
              }}
            >
              <div className={secClass}>Registrar actividad</div>
              <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Tipo de actividad">
                {TIPOS_ACTIVIDAD.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={actTipo === t}
                    onClick={() => setActTipo(t)}
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm font-bold",
                      actTipo === t
                        ? "bg-paramo-teal-soft text-paramo-teal-ink"
                        : "text-paramo-muted hover:bg-paramo-surface-2",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={actTexto}
                  onChange={(e) => setActTexto(e.target.value)}
                  placeholder="¿Qué pasó? Ej. Pidió precios de 8-pack"
                  className={cn(fieldClass, "min-w-[12rem] flex-1")}
                />
                <button type="submit" className={btnPri} disabled={busy}>
                  Guardar
                </button>
              </div>
            </form>
          ) : null}

          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={secClass}>Cotizaciones</span>
              {canEdit && p.activo ? (
                <Link href={`/cotizaciones?nueva=1&prospecto=${p.id}`} className={btnGhost}>
                  + Nueva cotización
                </Link>
              ) : null}
            </div>
            {cotizaciones.length === 0 ? (
              <p className="text-sm text-paramo-muted">Sin cotizaciones.</p>
            ) : (
              <ul className="divide-y divide-paramo-line rounded-lg border border-paramo-line bg-paramo-surface">
                {cotizaciones.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <Link
                        href={`/cotizaciones?abrir=${c.id}`}
                        className="block truncate text-sm font-semibold text-paramo-teal-ink hover:underline"
                      >
                        {c.numero}
                      </Link>
                      <span className="text-xs text-paramo-muted">
                        {estadoCotizacion(c.estado).nombre} · {formatDateCompact(c.fecha)}
                        {c.desc_pct ? ` · desc. ${c.desc_pct}%` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-paramo-fg">
                      {formatCOP(c.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={secClass}>Compromisos</span>
              {puedeAgendar ? (
                <button
                  type="button"
                  onClick={() => setAgendaOpen(true)}
                  className={btnGhost}
                >
                  + {puedeResponder ? "Agendar" : "Asignar tarea"}
                </button>
              ) : null}
            </div>
            {compromisos.length === 0 ? (
              <p className="text-sm text-paramo-muted">
                Sin compromisos. Agenda el próximo paso.
              </p>
            ) : (
              <ul className="divide-y divide-paramo-line rounded-lg border border-paramo-line bg-paramo-surface">
                {compromisos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold text-paramo-fg",
                          c.hecho && "text-paramo-muted line-through",
                        )}
                      >
                        {c.titulo}
                      </span>
                      <span className="text-xs text-paramo-muted">{c.tipo}</span>
                    </span>
                    <span className="shrink-0 text-xs text-paramo-muted">
                      {formatDateCompact(c.fecha)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className={secClass}>Productos de interés</div>
            {productos.length === 0 ? (
              <p className="mt-1 text-sm text-paramo-muted">
                No hay productos en el catálogo todavía.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {productos.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={x.interesado}
                    disabled={!canEdit || busy}
                    onClick={() => void run(() => toggleInteres(x.id, !x.interesado))}
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-xs font-bold disabled:cursor-not-allowed",
                      x.interesado
                        ? "border-paramo-teal bg-paramo-teal-soft text-paramo-teal-ink"
                        : "border-paramo-line text-paramo-muted hover:bg-paramo-surface-2",
                    )}
                  >
                    {x.nombre}
                    {x.estado !== "activo"
                      ? ` · ${x.estado === "desarrollo" ? "en desarrollo" : x.estado}`
                      : ""}
                  </button>
                ))}
              </div>
            )}
          </section>

          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                patchProspecto({
                  accion: "datos",
                  empresa: form.empresa,
                  nit: form.nit,
                  contacto: form.contacto,
                  cargo: form.cargo,
                  telefono: form.telefono,
                  email: form.email,
                  ciudad: form.ciudad,
                  canal_codigo: form.canal_codigo || null,
                  tipo_cliente_codigo: form.tipo_cliente_codigo || null,
                  fuente_codigo: form.fuente_codigo || null,
                  valor_mensual_estimado: form.valor ? Number(form.valor) : 0,
                  notas: form.notas,
                }),
              );
            }}
          >
            <div className={cn(secClass, "sm:col-span-2")}>Datos</div>
            <Field label="Empresa *" full>
              <input
                required
                disabled={!canEdit || busy}
                value={form.empresa}
                onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="NIT">
              <input
                disabled={!canEdit || busy}
                value={form.nit}
                onChange={(e) => setForm((f) => ({ ...f, nit: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Contacto">
              <input
                disabled={!canEdit || busy}
                value={form.contacto}
                onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Cargo">
              <input
                disabled={!canEdit || busy}
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Teléfono">
              <input
                disabled={!canEdit || busy}
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Correo">
              <input
                type="email"
                disabled={!canEdit || busy}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Ciudad">
              <input
                disabled={!canEdit || busy}
                value={form.ciudad}
                onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Canal">
              <select
                disabled={!canEdit || busy}
                value={form.canal_codigo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, canal_codigo: e.target.value }))
                }
                className={fieldClass}
              >
                <option value="">—</option>
                {catalogos.canales.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de cliente (precios)">
              <select
                disabled={!canEdit || busy}
                value={form.tipo_cliente_codigo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_cliente_codigo: e.target.value }))
                }
                className={fieldClass}
              >
                <option value="">Según el canal</option>
                {catalogos.tipos_cliente.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="¿Cómo llegó?">
              <select
                disabled={!canEdit || busy}
                value={form.fuente_codigo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fuente_codigo: e.target.value }))
                }
                className={fieldClass}
              >
                <option value="">—</option>
                {catalogos.fuentes.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Venta mensual estimada (COP)">
              <input
                type="number"
                min={0}
                disabled={!canEdit || busy}
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Notas" full>
              <textarea
                disabled={!canEdit || busy}
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                className={cn(fieldClass, "min-h-[88px] py-2")}
              />
            </Field>
            {canEdit ? (
              <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
                {confirmDelete ? (
                  <p className="mr-auto text-sm text-paramo-fg">
                    ¿Eliminar definitivamente? Si solo dejó de ser prospecto, mejor
                    inactívalo.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="mr-auto text-sm font-bold text-paramo-bad"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Eliminar
                  </button>
                )}
                {confirmDelete ? (
                  <>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => setConfirmDelete(false)}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex min-h-11 items-center rounded-full bg-paramo-bad px-4 text-sm font-bold text-paramo-brand-ink disabled:opacity-60"
                      onClick={() =>
                        void run(async () => {
                          const res = await fetch(`/api/prospectos/${p.id}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) {
                            throw new Error("No se pudo eliminar el prospecto.");
                          }
                          onDeleted(p.id);
                          router.refresh();
                        })
                      }
                    >
                      Sí, eliminar
                    </button>
                  </>
                ) : (
                  <button type="submit" className={btnPri} disabled={busy}>
                    Guardar cambios
                  </button>
                )}
              </div>
            ) : null}
          </form>

          <section>
            <div className={secClass}>Historial</div>
            {historial.length === 0 ? (
              <p className="mt-1 text-sm text-paramo-muted">Sin historial todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-paramo-line">
                {historial.map((a, i) => (
                  <li
                    key={`${a.f}-${a.t}-${i}`}
                    className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-2"
                  >
                    <span className="text-xs text-paramo-muted">
                      {formatDateCompact(a.f)}
                      <br />
                      {a.t}
                    </span>
                    <span className="text-sm text-paramo-fg">{a.x}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {obsOpen ? (
        <ObsDialog
          busy={busy}
          texto={obsTexto}
          onTexto={setObsTexto}
          onClose={() => setObsOpen(false)}
          onSubmit={() =>
            void run(async () => {
              const res = await fetch(`/api/prospectos/${p.id}/observaciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: obsTexto.trim() }),
              });
              const data = (await res.json().catch(() => null)) as {
                error?: string;
                observacion?: ObservacionItem;
              } | null;
              if (!res.ok || !data?.observacion) {
                throw new Error(data?.error ?? "No se pudo guardar la observación.");
              }
              setObservaciones((prev) => [data.observacion!, ...prev]);
              setObsTexto("");
              setObsOpen(false);
            })
          }
        />
      ) : null}

      {agendaOpen ? (
        <AgendaDialog
          prospectoId={p.id}
          empresa={p.empresa}
          prospectos={prospectosAgenda}
          responsables={catalogos.responsables}
          userId={userId}
          userRol={userRol}
          onClose={() => setAgendaOpen(false)}
          onCreated={(c) => {
            setCompromisos((prev) => [c, ...prev]);
            onCompromisoCreado?.(c);
            setAgendaOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block space-y-1", full && "sm:col-span-2")}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ObsDialog({
  texto,
  onTexto,
  busy,
  onClose,
  onSubmit,
}: {
  texto: string;
  onTexto: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const id = useId();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-paramo-fg/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="w-full max-w-md rounded-[12px] border border-paramo-line bg-paramo-surface p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (texto.trim()) onSubmit();
        }}
      >
        <h2 id={id} className="font-paramo-display text-lg font-bold text-paramo-fg">
          Nueva observación
        </h2>
        <label className="mt-3 block space-y-1">
          <span className={labelClass}>Observación *</span>
          <textarea
            required
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder="Qué viste y qué esperas que haga el comercial"
            className={cn(fieldClass, "min-h-[88px] py-2")}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={btnPri} disabled={busy}>
            Enviar observación
          </button>
        </div>
      </form>
    </div>
  );
}

function AgendaDialog({
  prospectoId,
  empresa,
  prospectos,
  responsables,
  userId,
  userRol,
  onClose,
  onCreated,
}: {
  prospectoId: string;
  empresa: string;
  prospectos: ProspectoListItem[];
  responsables: ProspectosCatalogos["responsables"];
  userId: string;
  userRol: Rol;
  onClose: () => void;
  onCreated: (c: CompromisoAgendaItem) => void;
}) {
  const titleId = useId();
  const hoy = todayBogota();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("Llamada");
  const [fecha, setFecha] = useState(addDaysYmd(hoy, 1));
  const [notas, setNotas] = useState("");
  const [responsableId, setResponsableId] = useState(userId);
  const [prospecto, setProspecto] = useState(prospectoId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opciones = prospectos
    .filter((item) => item.activo || item.id === prospectoId)
    .map((item) => ({ id: item.id, empresa: item.empresa }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "es"));
  if (!opciones.some((item) => item.id === prospectoId)) {
    opciones.unshift({ id: prospectoId, empresa });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!titulo.trim() || !fecha) {
      setError("Completa el compromiso y la fecha límite.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/compromisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          tipo,
          fecha,
          prospecto_id: prospecto,
          notas: notas.trim(),
          responsable_id: userRol === "supervisor" ? responsableId : userId,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        compromiso?: CompromisoAgendaItem;
      } | null;
      if (!res.ok || !data?.compromiso) {
        throw new Error(data?.error ?? "No se pudo guardar el compromiso.");
      }
      onCreated(data.compromiso);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el compromiso.");
      setSaving(false);
    }
  }

  const label =
    userRol === "supervisor" && responsableId !== userId ? "Asignar" : "Agendar";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-paramo-fg/40 p-4 sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => void onSubmit(e)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[12px] border border-paramo-line bg-paramo-surface p-4"
      >
        <h2 id={titleId} className="font-paramo-display text-xl font-bold text-paramo-fg">
          Nuevo compromiso
        </h2>
        <p className="mt-1 text-sm text-paramo-muted">{empresa}</p>
        {userRol === "supervisor" ? (
          <label className="mt-3 block space-y-1">
            <span className={labelClass}>¿Quién lo hace?</span>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className={fieldClass}
            >
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                  {r.id === userId ? " (yo)" : ""} · {ROL_LABEL[r.rol]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 block space-y-1">
          <span className={labelClass}>¿Qué hay que hacer? *</span>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Llevar muestras de Piña Bites"
            className={fieldClass}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={fieldClass}
            >
              {TIPOS_COMPROMISO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Fecha límite *</span>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ATAJOS_FECHA_COMPROMISO.map(([nombre, days]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => setFecha(addDaysYmd(hoy, days))}
              className={btnGhost}
            >
              {nombre}
            </button>
          ))}
        </div>
        <label className="mt-3 block space-y-1">
          <span className={labelClass}>Prospecto / cliente</span>
          <select
            value={prospecto}
            onChange={(e) => setProspecto(e.target.value)}
            className={fieldClass}
          >
            {opciones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.empresa}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block space-y-1">
          <span className={labelClass}>Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={cn(fieldClass, "min-h-[72px] py-2")}
          />
        </label>
        {error ? (
          <p className="mt-2 text-sm text-paramo-bad" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={btnPri} disabled={saving}>
            {saving ? "…" : label}
          </button>
        </div>
      </form>
    </div>
  );
}
