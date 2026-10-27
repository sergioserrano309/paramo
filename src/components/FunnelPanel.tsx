"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { CompromisoFechaText } from "@/components/CompromisoFechaText";
import { ProspectoDetalleDrawer } from "@/components/ProspectoDetalleDrawer";
import { CALIF_TXT, stars3 } from "@/config/calificacion";
import { ETAPA_COL_COLOR, STALE_DAYS } from "@/config/funnel";
import { MOTIVOS_PERDIDA } from "@/config/motivos-perdida";
import { ROL_LABEL, type Rol } from "@/config/roles";
import { canEditProspecto } from "@/lib/can";
import { cn } from "@/lib/cn";
import {
  daysBetween,
  formatMoneyShort,
  initials,
  localDayBogota,
  todayBogota,
} from "@/lib/format";
import type { ProximoCompromiso } from "@/lib/types/compromiso";
import type {
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
} from "@/lib/types/prospecto";

type FunnelPanelProps = {
  initialProspectos: ProspectoListItem[];
  catalogos: ProspectosCatalogos;
  canCreate: boolean;
  defaultResponsableId: string;
  userId: string;
  userRol: Rol;
  proximosPorProspecto: Record<string, ProximoCompromiso>;
};

type FormState = {
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
  etapa_codigo: string;
  valor_mensual_estimado: string;
  calificacion: string;
  notas: string;
  responsable_id: string;
};

function emptyForm(defaultResponsableId: string, etapaDefault: string): FormState {
  return {
    empresa: "",
    nit: "",
    contacto: "",
    cargo: "",
    telefono: "",
    email: "",
    ciudad: "",
    canal_codigo: "",
    tipo_cliente_codigo: "",
    fuente_codigo: "",
    etapa_codigo: etapaDefault,
    valor_mensual_estimado: "",
    calificacion: "0",
    notas: "",
    responsable_id: defaultResponsableId,
  };
}

function lastTouchDay(p: ProspectoListItem): string {
  if (p.ultimo_contacto) return p.ultimo_contacto;
  return localDayBogota(p.creado_en);
}

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const secClass =
  "text-[11px] font-extrabold uppercase tracking-[0.09em] text-paramo-muted";

export function FunnelPanel({
  initialProspectos,
  catalogos,
  canCreate,
  defaultResponsableId,
  userId,
  userRol,
  proximosPorProspecto,
}: FunnelPanelProps) {
  function canEdit(p: ProspectoListItem) {
    return canEditProspecto(userRol, userId, p.responsable_id);
  }
  const router = useRouter();
  const createTitleId = useId();
  const detailTitleId = useId();
  const lostTitleId = useId();

  const etapas = useMemo(
    () => [...catalogos.etapas].sort((a, b) => a.orden - b.orden),
    [catalogos.etapas],
  );
  const etapasAlta = etapas.filter((e) => e.en_pipeline);
  const etapaDefault =
    etapasAlta.find((e) => e.codigo === "prospecto")?.codigo ??
    etapasAlta[0]?.codigo ??
    "prospecto";
  const etapaIndex = useMemo(() => {
    const m = new Map<string, number>();
    etapas.forEach((e, i) => m.set(e.codigo, i));
    return m;
  }, [etapas]);

  const [prospectos, setProspectos] = useState(initialProspectos);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lostForId, setLostForId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptyForm(defaultResponsableId, etapaDefault),
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [finePointer, setFinePointer] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragPointerXRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    setProspectos(initialProspectos);
  }, [initialProspectos]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Al arrastrar cerca del borde izq/der, desplaza el tablero horizontalmente
  // para alcanzar columnas fuera de vista (p. ej. Ganado / Perdido).
  useEffect(() => {
    if (!dragId) {
      dragPointerXRef.current = null;
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      return;
    }

    const EDGE_PX = 72;
    const MAX_SPEED = 22;

    function onWindowDragOver(e: globalThis.DragEvent) {
      dragPointerXRef.current = e.clientX;
    }

    function tick() {
      const board = boardRef.current;
      const x = dragPointerXRef.current;
      if (board && x !== null) {
        const rect = board.getBoundingClientRect();
        let dx = 0;
        if (x < rect.left + EDGE_PX) {
          const t = Math.min(1, Math.max(0, (rect.left + EDGE_PX - x) / EDGE_PX));
          dx = -MAX_SPEED * (0.25 + 0.75 * t);
        } else if (x > rect.right - EDGE_PX) {
          const t = Math.min(1, Math.max(0, (x - (rect.right - EDGE_PX)) / EDGE_PX));
          dx = MAX_SPEED * (0.25 + 0.75 * t);
        }
        if (dx !== 0) {
          board.scrollLeft += dx;
        }
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener("dragover", onWindowDragOver);
    autoScrollRafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [dragId]);

  useEffect(() => {
    if (!createOpen && !openId && !lostForId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (lostForId) setLostForId(null);
      else if (createOpen) setCreateOpen(false);
      else setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, openId, lostForId]);

  const activos = useMemo(
    () => prospectos.filter((p) => p.activo),
    [prospectos],
  );
  const enGestion = useMemo(
    () =>
      activos.filter((p) => {
        const e = etapas.find((x) => x.codigo === p.etapa_codigo);
        return e?.en_pipeline;
      }),
    [activos, etapas],
  );
  const valorEnJuego = enGestion.reduce(
    (a, p) => a + (p.valor_mensual_estimado || 0),
    0,
  );

  const openProspecto = openId
    ? (prospectos.find((p) => p.id === openId) ?? null)
    : null;
  const lostProspecto = lostForId
    ? (prospectos.find((p) => p.id === lostForId) ?? null)
    : null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function nextEtapa(codigo: string): EtapaCatalogo | null {
    const i = etapaIndex.get(codigo);
    if (i === undefined) return null;
    return etapas[i + 1] ?? null;
  }

  async function createProspecto(payload: Record<string, unknown>) {
    const res = await fetch("/api/prospectos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      prospecto?: ProspectoListItem;
    } | null;
    if (!res.ok || !body?.prospecto) {
      throw new Error(body?.error ?? "No se pudo crear el prospecto.");
    }
    return body.prospecto;
  }

  async function patchEtapa(
    id: string,
    etapa_codigo: string,
    motivo_perdida?: string,
  ) {
    const res = await fetch(`/api/prospectos/${id}/etapa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        etapa_codigo,
        motivo_perdida: motivo_perdida ?? "",
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      prospecto?: ProspectoListItem;
    } | null;
    if (!res.ok || !body?.prospecto) {
      throw new Error(body?.error ?? "No se pudo actualizar la etapa.");
    }
    return body.prospecto;
  }

  async function moveToStage(
    id: string,
    etapa_codigo: string,
    motivo?: string,
  ) {
    const p = prospectos.find((x) => x.id === id);
    if (!p || p.etapa_codigo === etapa_codigo) return;
    if (!canEdit(p)) {
      setError("No autorizado para mover este prospecto.");
      return;
    }
    if (etapa_codigo === "perdido" && motivo === undefined) {
      setLostForId(id);
      return;
    }
    setError(null);
    setOk(null);
    setMovingId(id);
    try {
      const updated = await patchEtapa(id, etapa_codigo, motivo);
      setProspectos((prev) =>
        prev.map((x) => (x.id === id ? updated : x)),
      );
      if (etapa_codigo === "ganado") {
        setOk(`¡${updated.empresa} ganado!`);
      }
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar la etapa.",
      );
    } finally {
      setMovingId(null);
    }
  }

  async function onCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const created = await createProspecto({
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
        etapa_codigo: form.etapa_codigo || etapaDefault,
        valor_mensual_estimado: form.valor_mensual_estimado
          ? Number(form.valor_mensual_estimado)
          : 0,
        calificacion: Number(form.calificacion) || 0,
        notas: form.notas,
        responsable_id: form.responsable_id || defaultResponsableId,
      });
      setProspectos((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm(emptyForm(defaultResponsableId, etapaDefault));
      setOpenId(created.id);
      setOk(`${created.empresa} creado`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el prospecto.");
    } finally {
      setLoading(false);
    }
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  }

  function onDragEnd() {
    setDragId(null);
    setOverStage(null);
  }

  function onColDragOver(e: DragEvent, stage: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverStage(stage);
  }

  function onColDrop(e: DragEvent, stage: string) {
    e.preventDefault();
    setOverStage(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (id) void moveToStage(id, stage);
  }

  const t = todayBogota();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
            Funnel comercial
          </h1>
          <p className="text-sm text-paramo-muted">
            {enGestion.length} oportunidades activas ·{" "}
            {formatMoneyShort(valorEnJuego)}/mes en juego
            {finePointer
              ? " · arrastra las tarjetas o usa →"
              : " · usa → o abre la ficha para cambiar etapa"}
          </p>
        </header>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setForm(emptyForm(defaultResponsableId, etapaDefault));
              setCreateOpen(true);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110"
          >
            + Prospecto
          </button>
        ) : null}
      </div>

      {ok ? (
        <p className="text-sm text-paramo-good" role="status">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}

      <div
        ref={boardRef}
        className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3 overflow-x-auto pb-2"
        role="list"
        aria-label="Columnas del funnel"
      >
        {etapas.map((stage) => {
          const ps = activos
            .filter((p) => p.etapa_codigo === stage.codigo)
            .sort(
              (a, b) =>
                (b.calificacion || 0) - (a.calificacion || 0) ||
                (b.valor_mensual_estimado || 0) -
                  (a.valor_mensual_estimado || 0),
            );
          const sum = ps.reduce(
            (a, p) => a + (p.valor_mensual_estimado || 0),
            0,
          );
          const next = nextEtapa(stage.codigo);
          const colColor =
            ETAPA_COL_COLOR[stage.codigo] ?? "var(--paramo-line)";

          return (
            <div
              key={stage.codigo}
              role="listitem"
              data-stage={stage.codigo}
              onDragOver={(e) => onColDragOver(e, stage.codigo)}
              onDragLeave={() =>
                setOverStage((s) => (s === stage.codigo ? null : s))
              }
              onDrop={(e) => onColDrop(e, stage.codigo)}
              className={cn(
                "flex min-h-[160px] flex-col gap-2 rounded-[10px] bg-paramo-surface-2 p-2.5 border-2 border-dashed",
                overStage === stage.codigo
                  ? "border-paramo-teal"
                  : "border-transparent",
              )}
            >
              <div
                className="flex flex-col gap-0.5 border-b-[3px] px-1 pb-1.5"
                style={{ borderBottomColor: colColor }}
              >
                <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-paramo-fg">
                  <span>{stage.nombre}</span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paramo-surface px-1.5 text-[11px] font-extrabold text-paramo-muted">
                    {ps.length}
                  </span>
                </div>
                <span className="text-xs text-paramo-muted">
                  {formatMoneyShort(sum)}/mes · {stage.probabilidad}%
                </span>
              </div>

              {ps.map((p) => {
                const ed = canEdit(p);
                const dd = daysBetween(lastTouchDay(p), t);
                const stale =
                  stage.en_pipeline && dd >= STALE_DAYS;
                const draggable = ed && finePointer && movingId !== p.id;
                const respRol =
                  catalogos.responsables.find(
                    (r) => r.id === p.responsable_id,
                  )?.rol ?? userRol;
                const nc = proximosPorProspecto[p.id];

                return (
                  <div
                    key={p.id}
                    draggable={draggable}
                    onDragStart={
                      draggable ? (e) => onDragStart(e, p.id) : undefined
                    }
                    onDragEnd={onDragEnd}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-[9px] border border-paramo-line bg-paramo-surface p-2.5",
                      draggable && "cursor-grab active:cursor-grabbing",
                      dragId === p.id && "opacity-45",
                      movingId === p.id && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[13.5px] font-extrabold text-paramo-fg">
                        {p.empresa}
                      </span>
                      <span
                        title={`Responsable: ${p.responsable_nombre}`}
                        className={cn(
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                          respRol === "supervisor"
                            ? "bg-paramo-brand"
                            : "bg-paramo-teal",
                        )}
                      >
                        {initials(p.responsable_nombre)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-paramo-muted">
                      <span
                        className="text-paramo-olive"
                        title={CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
                      >
                        {stars3(p.calificacion)}
                      </span>
                      {p.canal_nombre ? (
                        <span>{p.canal_nombre}</span>
                      ) : null}
                    </div>
                    {nc ? (
                      <div className="text-xs text-paramo-muted">
                        <CompromisoFechaText fecha={nc.fecha} />{" "}
                        {nc.titulo}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="text-paramo-fg">
                        {p.valor_mensual_estimado ? (
                          formatMoneyShort(p.valor_mensual_estimado)
                        ) : (
                          <span className="text-paramo-muted">sin valor</span>
                        )}
                        {stale ? (
                          <span className="font-bold text-paramo-warn">
                            {" "}
                            · {dd}d
                          </span>
                        ) : null}
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setOpenId(p.id);
                          }}
                          className="rounded-md border border-paramo-line bg-paramo-surface px-2 py-1 text-[11.5px] font-bold text-paramo-muted hover:border-paramo-brand hover:text-paramo-brand"
                        >
                          Abrir
                        </button>
                        {ed && next && stage.en_pipeline ? (
                          <button
                            type="button"
                            title={`Mover a ${next.nombre}`}
                            disabled={movingId === p.id}
                            onClick={() => void moveToStage(p.id, next.codigo)}
                            className="rounded-md border border-paramo-line bg-paramo-surface px-2 py-1 text-[11.5px] font-bold text-paramo-muted hover:border-paramo-brand hover:text-paramo-brand disabled:opacity-50"
                          >
                            →
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </div>
                );
              })}

              {stage.codigo === "prospecto" && canCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setForm(emptyForm(defaultResponsableId, etapaDefault));
                    setCreateOpen(true);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-paramo-line bg-transparent px-3 text-sm font-bold text-paramo-fg hover:bg-paramo-surface"
                >
                  + Agregar
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Modal motivo perdido */}
      {lostProspecto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-paramo-fg/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLostForId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={lostTitleId}
            className="w-full max-w-md rounded-[10px] border border-paramo-line bg-paramo-surface p-5 shadow-lg"
          >
            <h2
              id={lostTitleId}
              className="font-paramo-display text-lg font-bold text-paramo-fg"
            >
              ¿Por qué se perdió {lostProspecto.empresa}?
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {MOTIVOS_PERDIDA.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={movingId === lostProspecto.id}
                  onClick={() => {
                    const id = lostProspecto.id;
                    setLostForId(null);
                    void moveToStage(id, "perdido", m);
                  }}
                  className="rounded-full border border-paramo-line bg-paramo-surface px-3 py-2 text-xs font-semibold text-paramo-muted hover:border-paramo-brand hover:bg-paramo-brand-soft hover:text-paramo-brand disabled:opacity-50"
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLostForId(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drawer detalle (ver + etapa) — mismo que click en listado Prospectos */}
      {openProspecto ? (
        <ProspectoDetalleDrawer
          titleId={detailTitleId}
          prospecto={openProspecto}
          etapas={etapas}
          etapaIndex={etapaIndex}
          canMove={canEdit(openProspecto)}
          moving={movingId === openProspecto.id}
          onClose={() => setOpenId(null)}
          onSetStage={(k) => void moveToStage(openProspecto.id, k)}
          catalogos={catalogos}
          prospectosAgenda={prospectos}
          userId={userId}
          userRol={userRol}
          onUpdated={(next) =>
            setProspectos((prev) =>
              prev.map((item) => (item.id === next.id ? next : item)),
            )
          }
          onDeleted={(id) => {
            setProspectos((prev) => prev.filter((item) => item.id !== id));
            setOpenId(null);
          }}
        />
      ) : null}

      {/* Drawer alta */}
      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-paramo-fg/40"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={createTitleId}
            className="flex h-full w-full max-w-lg flex-col border-l border-paramo-line bg-paramo-surface shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-paramo-line px-4 py-3">
              <h2
                id={createTitleId}
                className="mr-auto font-paramo-display text-xl font-bold text-paramo-fg"
              >
                Nuevo prospecto
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setCreateOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
              >
                ✕
              </button>
            </div>
            <form
              className="flex flex-1 flex-col overflow-y-auto p-4"
              onSubmit={onCreateSubmit}
              noValidate
            >
              <fieldset disabled={loading} className="grid gap-3 sm:grid-cols-2">
                <legend className={cn(secClass, "mb-1 w-full")}>Datos</legend>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="fn-empresa" className={labelClass}>
                    Empresa *
                  </label>
                  <input
                    id="fn-empresa"
                    required
                    maxLength={200}
                    value={form.empresa}
                    onChange={(e) => setField("empresa", e.target.value)}
                    className={fieldClass}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-nit" className={labelClass}>
                    NIT
                  </label>
                  <input
                    id="fn-nit"
                    maxLength={40}
                    value={form.nit}
                    onChange={(e) => setField("nit", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-contacto" className={labelClass}>
                    Contacto
                  </label>
                  <input
                    id="fn-contacto"
                    maxLength={120}
                    value={form.contacto}
                    onChange={(e) => setField("contacto", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-cargo" className={labelClass}>
                    Cargo
                  </label>
                  <input
                    id="fn-cargo"
                    maxLength={120}
                    value={form.cargo}
                    onChange={(e) => setField("cargo", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-tel" className={labelClass}>
                    Teléfono
                  </label>
                  <input
                    id="fn-tel"
                    type="tel"
                    maxLength={40}
                    value={form.telefono}
                    onChange={(e) => setField("telefono", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-email" className={labelClass}>
                    Correo
                  </label>
                  <input
                    id="fn-email"
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-ciudad" className={labelClass}>
                    Ciudad
                  </label>
                  <input
                    id="fn-ciudad"
                    maxLength={120}
                    value={form.ciudad}
                    onChange={(e) => setField("ciudad", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-canal" className={labelClass}>
                    Canal
                  </label>
                  <select
                    id="fn-canal"
                    value={form.canal_codigo}
                    onChange={(e) => setField("canal_codigo", e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">—</option>
                    {catalogos.canales.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-tipo" className={labelClass}>
                    Tipo de cliente (precios)
                  </label>
                  <select
                    id="fn-tipo"
                    value={form.tipo_cliente_codigo}
                    onChange={(e) =>
                      setField("tipo_cliente_codigo", e.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="">Según el canal</option>
                    {catalogos.tipos_cliente.map((tOpt) => (
                      <option key={tOpt.codigo} value={tOpt.codigo}>
                        {tOpt.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-fuente" className={labelClass}>
                    ¿Cómo llegó?
                  </label>
                  <select
                    id="fn-fuente"
                    value={form.fuente_codigo}
                    onChange={(e) => setField("fuente_codigo", e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">—</option>
                    {catalogos.fuentes.map((f) => (
                      <option key={f.codigo} value={f.codigo}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-valor" className={labelClass}>
                    Venta mensual estimada (COP)
                  </label>
                  <input
                    id="fn-valor"
                    type="number"
                    min={0}
                    step={10000}
                    inputMode="numeric"
                    value={form.valor_mensual_estimado}
                    onChange={(e) =>
                      setField("valor_mensual_estimado", e.target.value)
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-etapa" className={labelClass}>
                    Etapa
                  </label>
                  <select
                    id="fn-etapa"
                    value={form.etapa_codigo}
                    onChange={(e) => setField("etapa_codigo", e.target.value)}
                    className={fieldClass}
                  >
                    {etapasAlta.map((e) => (
                      <option key={e.codigo} value={e.codigo}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="fn-calif" className={labelClass}>
                    Calificación
                  </label>
                  <select
                    id="fn-calif"
                    value={form.calificacion}
                    onChange={(e) => setField("calificacion", e.target.value)}
                    className={fieldClass}
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n ? `${"★".repeat(n)} ` : ""}
                        {CALIF_TXT[n]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="fn-resp" className={labelClass}>
                    Responsable
                  </label>
                  <select
                    id="fn-resp"
                    value={form.responsable_id}
                    onChange={(e) => setField("responsable_id", e.target.value)}
                    className={fieldClass}
                  >
                    {catalogos.responsables.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} · {ROL_LABEL[r.rol]}
                        {r.id === userId ? " (yo)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="fn-notas" className={labelClass}>
                    Notas
                  </label>
                  <textarea
                    id="fn-notas"
                    rows={3}
                    maxLength={4000}
                    value={form.notas}
                    onChange={(e) => setField("notas", e.target.value)}
                    className={`${fieldClass} min-h-[88px] py-2`}
                  />
                </div>
              </fieldset>

              {error && createOpen ? (
                <p className="mt-3 text-sm text-paramo-bad" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-auto flex justify-end gap-2 border-t border-paramo-line pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando…" : "Crear prospecto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
