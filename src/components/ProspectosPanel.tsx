"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ROL_LABEL } from "@/config/roles";
import type {
  ProspectoListItem,
  ProspectosCatalogos,
} from "@/lib/types/prospecto";

type ProspectosPanelProps = {
  initialProspectos: ProspectoListItem[];
  catalogos: ProspectosCatalogos;
  canCreate: boolean;
  defaultResponsableId: string;
};

const CALIF_TXT = [
  "Sin calificar",
  "Potencial bajo",
  "Potencial medio",
  "Potencial alto",
] as const;

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

function formatCOP(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function stars(n: number) {
  const v = Math.max(0, Math.min(3, n || 0));
  return "★".repeat(v) + "☆".repeat(3 - v);
}

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";

export function ProspectosPanel({
  initialProspectos,
  catalogos,
  canCreate,
  defaultResponsableId,
}: ProspectosPanelProps) {
  const router = useRouter();
  const titleId = useId();
  const etapasAlta = catalogos.etapas.filter((e) => e.en_pipeline);
  const etapaDefault =
    etapasAlta.find((e) => e.codigo === "prospecto")?.codigo ??
    etapasAlta[0]?.codigo ??
    "prospecto";

  const [prospectos, setProspectos] = useState(initialProspectos);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    setProspectos(initialProspectos);
  }, [initialProspectos]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  async function onQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const created = await createProspecto({
        empresa: quick.empresa,
        contacto: quick.contacto,
        telefono: quick.telefono,
        canal_codigo: quick.canal_codigo || null,
        responsable_id: quick.responsable_id || defaultResponsableId,
        etapa_codigo: "prospecto",
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el prospecto.");
    } finally {
      setLoading(false);
    }
  }

  async function onDrawerSubmit(event: FormEvent<HTMLFormElement>) {
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
      setDrawerOpen(false);
      setForm(emptyForm(defaultResponsableId, etapaDefault));
      setOk(`${created.empresa} creado`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el prospecto.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = prospectos.filter((p) => {
    if (!q.trim()) return true;
    const hay = [
      p.empresa,
      p.contacto,
      p.ciudad,
      p.telefono,
      p.email,
      p.nit,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

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
              setDrawerOpen(true);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110"
          >
            Prospecto
          </button>
        ) : null}
      </div>

      {ok ? (
        <p className="text-sm text-paramo-good" role="status">
          {ok}
        </p>
      ) : null}
      {error && !drawerOpen ? (
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
                required
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
              {loading ? "…" : "Agregar"}
            </button>
          </form>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar empresa, contacto, NIT…"
          className={`${fieldClass} max-w-md flex-1`}
          aria-label="Buscar prospectos"
        />
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
              ? "Cambia la búsqueda."
              : canCreate
                ? "Escribe el nombre de la empresa arriba y presiona Agregar, o usa Prospecto."
                : "El comercial aún no ha registrado prospectos."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-paramo-line bg-paramo-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                <th className="px-3 py-2 font-bold">Empresa</th>
                <th className="px-3 py-2 font-bold">Calif.</th>
                <th className="px-3 py-2 font-bold">Etapa</th>
                <th className="px-3 py-2 font-bold">Responsable</th>
                <th className="px-3 py-2 text-right font-bold">Venta mens. est.</th>
                <th className="px-3 py-2 font-bold">Canal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-paramo-line last:border-b-0 ${
                    p.activo ? "" : "opacity-60"
                  }`}
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-paramo-fg">
                      {p.empresa}
                      {!p.activo ? (
                        <span className="ml-2 text-xs text-paramo-muted">
                          Inactivo
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-paramo-muted">
                      {[p.contacto, p.ciudad].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td
                    className="px-3 py-3 text-paramo-olive"
                    title={CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
                  >
                    {stars(p.calificacion)}
                  </td>
                  <td className="px-3 py-3 text-paramo-fg">{p.etapa_nombre}</td>
                  <td className="px-3 py-3 text-paramo-fg">
                    {p.responsable_nombre}
                  </td>
                  <td className="px-3 py-3 text-right text-paramo-fg">
                    {formatCOP(p.valor_mensual_estimado)}
                  </td>
                  <td className="px-3 py-3 text-paramo-muted">
                    {p.canal_nombre ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-paramo-fg/40"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-full w-full max-w-lg flex-col border-l border-paramo-line bg-paramo-surface shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-paramo-line px-4 py-3">
              <h2
                id={titleId}
                className="mr-auto font-paramo-display text-xl font-bold text-paramo-fg"
              >
                Nuevo prospecto
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
              >
                ✕
              </button>
            </div>
            <form
              className="flex flex-1 flex-col overflow-y-auto p-4"
              onSubmit={onDrawerSubmit}
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
                    required
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

              {error ? (
                <p className="mt-3 text-sm text-paramo-bad" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-auto flex justify-end gap-2 border-t border-paramo-line pt-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
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
