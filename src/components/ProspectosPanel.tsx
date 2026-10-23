"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { CompromisoFechaText } from "@/components/CompromisoFechaText";
import { ProspectoDetalleDrawer } from "@/components/ProspectoDetalleDrawer";
import { StagePill } from "@/components/StagePill";
import { WhoChip } from "@/components/WhoChip";
import { CALIF_TXT, stars3 } from "@/config/calificacion";
import { STALE_DAYS } from "@/config/funnel";
import { MOTIVOS_PERDIDA } from "@/config/motivos-perdida";
import { ROL_LABEL, type Rol } from "@/config/roles";
import { canEditProspecto } from "@/lib/can";
import { cn } from "@/lib/cn";
import {
  formatMoneyShort,
  formatUltimoContacto,
  todayBogota,
} from "@/lib/format";
import type { ProximoCompromiso } from "@/lib/types/compromiso";
import type {
  ProspectoListItem,
  ProspectosCatalogos,
} from "@/lib/types/prospecto";

type ProspectosPanelProps = {
  initialProspectos: ProspectoListItem[];
  catalogos: ProspectosCatalogos;
  canCreate: boolean;
  defaultResponsableId: string;
  userId: string;
  userRol: Rol;
  proximosPorProspecto: Record<string, ProximoCompromiso>;
  /** Token de `?nuevo=` (atajo N). Si viene, abre el alta. */
  nuevoToken?: string;
  /** `?abrir=` abre la ficha de ese prospecto. */
  abrirInicial?: string;
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

type Filters = {
  q: string;
  /** '' = todas; 'activos' | 'inactivos' | codigo etapa */
  etapa: string;
  canal: string;
  resp: string;
  /** '' = cualquiera; '0'|'1'|'2'|'3' igualdad exacta */
  calif: string;
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

function empresaSubline(p: ProspectoListItem): string {
  return [p.contacto, p.ciudad].filter(Boolean).join(" · ");
}

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
/** Como as-is `.filters .inp { width: auto }` — no forzar w-full o apilan en columna. */
const filterFieldClass =
  "min-h-11 w-auto max-w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-sm text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const thClass =
  "px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-[0.07em] text-paramo-muted whitespace-nowrap";

export function ProspectosPanel({
  initialProspectos,
  catalogos,
  canCreate,
  defaultResponsableId,
  userId,
  userRol,
  proximosPorProspecto,
  nuevoToken = "",
  abrirInicial = "",
}: ProspectosPanelProps) {
  const router = useRouter();
  const createTitleId = useId();
  const detailTitleId = useId();
  const etapasOrdenadas = useMemo(
    () => [...catalogos.etapas].sort((a, b) => a.orden - b.orden),
    [catalogos.etapas],
  );
  const etapasAlta = etapasOrdenadas.filter((e) => e.en_pipeline);
  const etapaDefault =
    etapasAlta.find((e) => e.codigo === "prospecto")?.codigo ??
    etapasAlta[0]?.codigo ??
    "prospecto";
  const etapaIndex = useMemo(() => {
    const m = new Map<string, number>();
    etapasOrdenadas.forEach((e, i) => m.set(e.codigo, i));
    return m;
  }, [etapasOrdenadas]);
  const pipelineCodigos = useMemo(
    () => new Set(etapasAlta.map((e) => e.codigo)),
    [etapasAlta],
  );

  const [prospectos, setProspectos] = useState(initialProspectos);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(abrirInicial || null);
  const [lostForId, setLostForId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptyForm(defaultResponsableId, etapaDefault),
  );
  const [quick, setQuick] = useState({
    empresa: "",
    contacto: "",
    telefono: "",
    canal_codigo: "",
    responsable_id: defaultResponsableId,
  });
  const [filters, setFilters] = useState<Filters>({
    q: "",
    etapa: "",
    canal: "",
    resp: "",
    calif: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProspectos(initialProspectos);
  }, [initialProspectos]);

  useEffect(() => {
    if (nuevoToken && canCreate) setCreateOpen(true);
  }, [nuevoToken, canCreate]);

  useEffect(() => {
    if (!createOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCreateOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen]);

  function canEdit(p: ProspectoListItem) {
    return canEditProspecto(userRol, userId, p.responsable_id);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function rolDe(responsableId: string): Rol {
    return (
      catalogos.responsables.find((r) => r.id === responsableId)?.rol ??
      userRol
    );
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

  async function onQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    const empresa = quick.empresa.trim();
    if (!empresa) return;
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const created = await createProspecto({
        empresa,
        contacto: quick.contacto.trim(),
        telefono: quick.telefono.trim(),
        canal_codigo: quick.canal_codigo || null,
        responsable_id: quick.responsable_id || defaultResponsableId,
        etapa_codigo: "prospecto",
        nit: "",
        cargo: "",
        email: "",
        ciudad: "",
        tipo_cliente_codigo: null,
        fuente_codigo: null,
        valor_mensual_estimado: 0,
        calificacion: 0,
        notas: "",
      });
      setProspectos((prev) => [created, ...prev]);
      setQuick({
        empresa: "",
        contacto: "",
        telefono: "",
        canal_codigo: "",
        responsable_id: defaultResponsableId,
      });
      setOk(`${created.empresa} agregado`);
      router.refresh();
      setTimeout(() => {
        document.getElementById("qp-empresa")?.focus();
      }, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el prospecto.");
    } finally {
      setLoading(false);
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
        valor_mensual_estimado: Number(form.valor_mensual_estimado) || 0,
        calificacion: Number(form.calificacion) || 0,
        notas: form.notas,
        responsable_id: form.responsable_id || defaultResponsableId,
      });
      setProspectos((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm(emptyForm(defaultResponsableId, etapaDefault));
      setOk(`${created.empresa} creado`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el prospecto.");
    } finally {
      setLoading(false);
    }
  }

  const nInactivos = prospectos.filter((p) => !p.activo).length;
  const hoy = todayBogota();

  const filtered = useMemo(() => {
    let list = prospectos.slice();
    const f = filters;

    if (f.etapa === "inactivos") {
      list = list.filter((p) => !p.activo);
    } else {
      list = list.filter((p) => p.activo);
      if (f.etapa === "activos") {
        list = list.filter((p) => pipelineCodigos.has(p.etapa_codigo));
      } else if (f.etapa) {
        list = list.filter((p) => p.etapa_codigo === f.etapa);
      }
    }

    if (f.canal) list = list.filter((p) => p.canal_codigo === f.canal);
    if (f.resp) list = list.filter((p) => p.responsable_id === f.resp);
    if (f.calif !== "") {
      const n = Number(f.calif);
      list = list.filter((p) => p.calificacion === n);
    }
    if (f.q.trim()) {
      const q = f.q.trim().toLowerCase();
      list = list.filter((p) =>
        [p.empresa, p.contacto, p.ciudad, p.telefono, p.email, p.nit]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    list.sort((a, b) => {
      const c = (b.calificacion || 0) - (a.calificacion || 0);
      if (c) return c;
      const ei =
        (etapaIndex.get(b.etapa_codigo) ?? 0) -
        (etapaIndex.get(a.etapa_codigo) ?? 0);
      if (ei) return ei;
      return (b.valor_mensual_estimado || 0) - (a.valor_mensual_estimado || 0);
    });

    return list;
  }, [prospectos, filters, pipelineCodigos, etapaIndex]);

  const openProspecto = openId
    ? (prospectos.find((p) => p.id === openId) ?? null)
    : null;
  const lostProspecto = lostForId
    ? (prospectos.find((p) => p.id === lostForId) ?? null)
    : null;

  function openDetalle(id: string) {
    setError(null);
    setOpenId(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
            Prospectos
          </h1>
          <p className="text-sm text-paramo-muted">
            Clientes potenciales y actuales · calificación ★ a ★★★
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
      {error && !createOpen && !openId ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}

      {canCreate ? (
        <section className="rounded-[10px] border border-paramo-line bg-paramo-surface p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={onQuickSubmit}
            noValidate
          >
            <div className="min-w-[200px] flex-[2] space-y-1">
              <label htmlFor="qp-empresa" className={labelClass}>
                Empresa *
              </label>
              <input
                id="qp-empresa"
                required
                maxLength={200}
                value={quick.empresa}
                onChange={(e) =>
                  setQuick((s) => ({ ...s, empresa: e.target.value }))
                }
                placeholder="Ej. Mercado Saludable La 93"
                className={fieldClass}
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <label htmlFor="qp-contacto" className={labelClass}>
                Contacto
              </label>
              <input
                id="qp-contacto"
                maxLength={120}
                value={quick.contacto}
                onChange={(e) =>
                  setQuick((s) => ({ ...s, contacto: e.target.value }))
                }
                placeholder="Nombre"
                className={fieldClass}
              />
            </div>
            <div className="min-w-[120px] flex-1 space-y-1">
              <label htmlFor="qp-tel" className={labelClass}>
                Teléfono
              </label>
              <input
                id="qp-tel"
                type="tel"
                maxLength={40}
                value={quick.telefono}
                onChange={(e) =>
                  setQuick((s) => ({ ...s, telefono: e.target.value }))
                }
                className={fieldClass}
              />
            </div>
            <div className="min-w-[160px] flex-1 space-y-1">
              <label htmlFor="qp-canal" className={labelClass}>
                Canal
              </label>
              <select
                id="qp-canal"
                value={quick.canal_codigo}
                onChange={(e) =>
                  setQuick((s) => ({ ...s, canal_codigo: e.target.value }))
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
            </div>
            <div className="min-w-[160px] flex-1 space-y-1">
              <label htmlFor="qp-resp" className={labelClass}>
                Responsable
              </label>
              <select
                id="qp-resp"
                value={quick.responsable_id}
                onChange={(e) =>
                  setQuick((s) => ({ ...s, responsable_id: e.target.value }))
                }
                className={fieldClass}
              >
                {catalogos.responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} · {ROL_LABEL[r.rol]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "…" : "+ Agregar"}
            </button>
          </form>
        </section>
      ) : null}

      {/* As-is .filters: fila horizontal, inputs width:auto, búsqueda flex:1 1 200px */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Buscar empresa, contacto, NIT…"
          className={`${filterFieldClass} min-w-[200px] flex-[1_1_200px]`}
          aria-label="Buscar prospectos"
        />
        <select
          aria-label="Filtrar por etapa"
          value={filters.etapa}
          onChange={(e) => setFilters((f) => ({ ...f, etapa: e.target.value }))}
          className={filterFieldClass}
        >
          <option value="activos">En gestión</option>
          <option value="">Todas las etapas</option>
          {etapasOrdenadas.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nombre}
            </option>
          ))}
          <option value="inactivos">Inactivos ({nInactivos})</option>
        </select>
        <select
          aria-label="Filtrar por canal"
          value={filters.canal}
          onChange={(e) => setFilters((f) => ({ ...f, canal: e.target.value }))}
          className={filterFieldClass}
        >
          <option value="">Todos los canales</option>
          {catalogos.canales.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por responsable"
          value={filters.resp}
          onChange={(e) => setFilters((f) => ({ ...f, resp: e.target.value }))}
          className={filterFieldClass}
        >
          <option value="">Todos los responsables</option>
          {catalogos.responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por calificación"
          value={filters.calif}
          onChange={(e) => setFilters((f) => ({ ...f, calif: e.target.value }))}
          className={filterFieldClass}
        >
          <option value="">Cualquier calificación</option>
          <option value="0">Sin calificar</option>
          <option value="1">★ Potencial bajo</option>
          <option value="2">★★ Potencial medio</option>
          <option value="3">★★★ Potencial alto</option>
        </select>
        <span className="text-sm text-paramo-muted">
          {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-8 text-center">
          <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
            {prospectos.length
              ? "Ningún registro coincide con el filtro"
              : "Aún no hay prospectos"}
          </h3>
          <p className="mt-1 text-sm text-paramo-muted">
            {prospectos.length
              ? "Cambia la búsqueda o los filtros."
              : canCreate
                ? "Escribe el nombre de la empresa arriba y presiona Agregar, o usa Prospecto."
                : "El comercial aún no ha registrado prospectos."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabla as-is */}
          <div className="hidden overflow-x-auto rounded-[10px] border border-paramo-line bg-paramo-surface sm:block">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-paramo-line">
                  <th className={thClass}>Empresa</th>
                  <th className={thClass}>Calif.</th>
                  <th className={thClass}>Etapa</th>
                  <th className={thClass}>Responsable</th>
                  <th className={`${thClass} text-right`}>Venta mensual est.</th>
                  <th className={thClass}>Próximo compromiso</th>
                  <th className={`${thClass} text-right`}>Último contacto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const nc = proximosPorProspecto[p.id];
                  const touch = formatUltimoContacto(
                    p.ultimo_contacto,
                    p.creado_en,
                    hoy,
                  );
                  const stale =
                    touch.days !== null &&
                    touch.days >= STALE_DAYS &&
                    pipelineCodigos.has(p.etapa_codigo) &&
                    p.activo;
                  const sub = empresaSubline(p);

                  return (
                    <tr
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetalle(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetalle(p.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-paramo-line last:border-b-0 hover:bg-paramo-surface-2/70",
                        !p.activo && "opacity-60",
                      )}
                    >
                      <td className="px-3 py-3">
                        <div className="font-bold text-paramo-fg">
                          {p.empresa}
                          {!p.activo ? (
                            <span className="ml-2 rounded-full bg-paramo-surface-2 px-2 py-0.5 text-[11px] font-bold text-paramo-muted">
                              Inactivo
                            </span>
                          ) : null}
                        </div>
                        {sub ? (
                          <div className="text-xs text-paramo-muted">{sub}</div>
                        ) : null}
                      </td>
                      <td
                        className="px-3 py-3 text-paramo-olive"
                        title={CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
                      >
                        {stars3(p.calificacion)}
                      </td>
                      <td className="px-3 py-3">
                        <StagePill
                          codigo={p.etapa_codigo}
                          nombre={p.etapa_nombre}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <WhoChip
                          nombre={p.responsable_nombre}
                          rol={rolDe(p.responsable_id)}
                          showRol
                        />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-paramo-fg">
                        {p.valor_mensual_estimado
                          ? formatMoneyShort(p.valor_mensual_estimado)
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {nc ? (
                          <span className="inline-flex flex-wrap items-baseline gap-1.5">
                            <CompromisoFechaText fecha={nc.fecha} />
                            <span className="text-xs text-paramo-muted">
                              {nc.titulo}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-paramo-muted">
                            Sin compromiso
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right tabular-nums",
                          stale
                            ? "font-bold text-paramo-warn"
                            : "text-xs text-paramo-muted",
                        )}
                      >
                        {touch.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil: cards (as-is mcards) */}
          <div className="grid gap-2 sm:hidden">
            {filtered.map((p) => {
              const nc = proximosPorProspecto[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openDetalle(p.id)}
                  className={cn(
                    "rounded-[10px] border border-paramo-line bg-paramo-surface p-3 text-left",
                    !p.activo && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <b className="text-[14px] text-paramo-fg">{p.empresa}</b>
                    <StagePill
                      codigo={p.etapa_codigo}
                      nombre={p.etapa_nombre}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-paramo-muted">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-paramo-olive">
                        {stars3(p.calificacion)}
                      </span>
                      <span>{p.responsable_nombre}</span>
                    </span>
                    <span>
                      {p.valor_mensual_estimado
                        ? formatMoneyShort(p.valor_mensual_estimado)
                        : ""}
                    </span>
                  </div>
                  {nc ? (
                    <div className="mt-1 text-xs text-paramo-muted">
                      <CompromisoFechaText fecha={nc.fecha} />
                      {" · "}
                      {nc.titulo}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}

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
            aria-label="Motivo de pérdida"
            className="w-full max-w-md rounded-[12px] border border-paramo-line bg-paramo-surface p-4 shadow-lg"
          >
            <h2 className="font-paramo-display text-lg font-bold text-paramo-fg">
              Motivo de pérdida
            </h2>
            <p className="mt-1 text-sm text-paramo-muted">
              {lostProspecto.empresa}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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

      {openProspecto ? (
        <ProspectoDetalleDrawer
          titleId={detailTitleId}
          prospecto={openProspecto}
          etapas={etapasOrdenadas}
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
                <legend className="mb-1 w-full text-xs font-bold uppercase tracking-wide text-paramo-muted">
                  Datos
                </legend>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="dp-empresa" className={labelClass}>
                    Empresa *
                  </label>
                  <input
                    id="dp-empresa"
                    required
                    maxLength={200}
                    value={form.empresa}
                    onChange={(e) => setField("empresa", e.target.value)}
                    className={fieldClass}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-nit" className={labelClass}>
                    NIT
                  </label>
                  <input
                    id="dp-nit"
                    maxLength={40}
                    value={form.nit}
                    onChange={(e) => setField("nit", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-contacto" className={labelClass}>
                    Contacto
                  </label>
                  <input
                    id="dp-contacto"
                    maxLength={120}
                    value={form.contacto}
                    onChange={(e) => setField("contacto", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-cargo" className={labelClass}>
                    Cargo
                  </label>
                  <input
                    id="dp-cargo"
                    maxLength={120}
                    value={form.cargo}
                    onChange={(e) => setField("cargo", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-tel" className={labelClass}>
                    Teléfono
                  </label>
                  <input
                    id="dp-tel"
                    type="tel"
                    maxLength={40}
                    value={form.telefono}
                    onChange={(e) => setField("telefono", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-email" className={labelClass}>
                    Correo
                  </label>
                  <input
                    id="dp-email"
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-ciudad" className={labelClass}>
                    Ciudad
                  </label>
                  <input
                    id="dp-ciudad"
                    maxLength={120}
                    value={form.ciudad}
                    onChange={(e) => setField("ciudad", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-canal" className={labelClass}>
                    Canal
                  </label>
                  <select
                    id="dp-canal"
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
                  <label htmlFor="dp-tipo" className={labelClass}>
                    Tipo de cliente (precios)
                  </label>
                  <select
                    id="dp-tipo"
                    value={form.tipo_cliente_codigo}
                    onChange={(e) =>
                      setField("tipo_cliente_codigo", e.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="">Según el canal</option>
                    {catalogos.tipos_cliente.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="dp-fuente" className={labelClass}>
                    ¿Cómo llegó?
                  </label>
                  <select
                    id="dp-fuente"
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
                  <label htmlFor="dp-valor" className={labelClass}>
                    Venta mensual estimada (COP)
                  </label>
                  <input
                    id="dp-valor"
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
                  <label htmlFor="dp-etapa" className={labelClass}>
                    Etapa
                  </label>
                  <select
                    id="dp-etapa"
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
                  <label htmlFor="dp-calif" className={labelClass}>
                    Calificación
                  </label>
                  <select
                    id="dp-calif"
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
                  <label htmlFor="dp-resp" className={labelClass}>
                    Responsable
                  </label>
                  <select
                    id="dp-resp"
                    value={form.responsable_id}
                    onChange={(e) => setField("responsable_id", e.target.value)}
                    className={fieldClass}
                  >
                    {catalogos.responsables.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} · {ROL_LABEL[r.rol]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="dp-notas" className={labelClass}>
                    Notas
                  </label>
                  <textarea
                    id="dp-notas"
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
