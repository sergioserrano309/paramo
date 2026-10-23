"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { ObservacionItem } from "@/lib/types/observacion";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnTeal =
  "inline-flex min-h-9 items-center justify-center rounded-full bg-paramo-teal px-4 text-xs font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function llamar<T>(url: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !json) throw new Error(json?.error ?? "No se pudo completar la acción.");
  return json;
}

type ListaProps = {
  observaciones: ObservacionItem[];
  userId: string;
  /** `editar`: el comercial responde y marca atendida. */
  puedeAtender: boolean;
  /** `observar`: el supervisor retira las suyas abiertas. */
  puedeObservar: boolean;
  onActualizada: (o: ObservacionItem) => void;
  onRetirada: (id: string) => void;
};

/** Lista de observaciones con respuesta inline (as-is obsList). */
export function ObservacionesLista({
  observaciones,
  userId,
  puedeAtender,
  puedeObservar,
  onActualizada,
  onRetirada,
}: ListaProps) {
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (observaciones.length === 0) {
    return <p className="text-sm text-paramo-muted">Sin observaciones.</p>;
  }

  async function atender(e: FormEvent, id: string) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await llamar<{ observacion: ObservacionItem }>(
        `/api/observaciones/${id}`,
        "POST",
        { respuesta },
      );
      onActualizada(res.observacion);
      setRespondiendo(null);
      setRespuesta("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo atender la observación.");
    } finally {
      setCargando(false);
    }
  }

  async function retirar(id: string) {
    setCargando(true);
    setError(null);
    try {
      await llamar<{ ok: true }>(`/api/observaciones/${id}`, "DELETE");
      onRetirada(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo retirar la observación.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}
      {observaciones.map((o) => {
        const atendida = o.estado === "atendida";
        return (
          <div
            key={o.id}
            className={`space-y-2 rounded-[10px] border border-paramo-line p-3 ${
              atendida ? "opacity-70" : ""
            }`}
          >
            <p className="text-sm text-paramo-fg">{o.texto}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
              <span>
                {o.autor_nombre} · {fechaHora(o.creado_en)}
              </span>
              {o.prospecto_empresa ? (
                <span className="font-bold text-paramo-fg">{o.prospecto_empresa}</span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${
                  atendida
                    ? "border border-paramo-line"
                    : "bg-paramo-brand-soft text-paramo-brand"
                }`}
              >
                {atendida ? "Atendida" : "Abierta"}
              </span>
            </div>
            {atendida && o.respuesta ? (
              <p className="rounded-lg bg-paramo-surface-2 p-2 text-sm text-paramo-fg">
                <b>Respuesta:</b> {o.respuesta}
                {o.atendida_en ? (
                  <span className="text-xs text-paramo-muted"> · {fechaHora(o.atendida_en)}</span>
                ) : null}
              </p>
            ) : null}
            {!atendida && puedeAtender ? (
              respondiendo === o.id ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => atender(e, o.id)}>
                  <input
                    aria-label="Respuesta"
                    value={respuesta}
                    maxLength={2000}
                    onChange={(e) => setRespuesta(e.target.value)}
                    placeholder="¿Qué hiciste? (opcional)"
                    className={`${fieldClass} min-w-[200px] flex-1`}
                    autoFocus
                  />
                  <button type="submit" disabled={cargando} className={btnTeal}>
                    Marcar atendida
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondiendo(null)}
                    className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-paramo-muted hover:bg-paramo-surface-2"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRespondiendo(o.id);
                    setRespuesta("");
                  }}
                  className="inline-flex min-h-9 items-center rounded-full border border-paramo-line px-3 text-xs font-bold text-paramo-fg hover:bg-paramo-surface-2"
                >
                  Responder y marcar atendida
                </button>
              )
            ) : null}
            {!atendida && puedeObservar && o.autor_id === userId ? (
              <button
                type="button"
                disabled={cargando}
                onClick={() => retirar(o.id)}
                className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-paramo-muted hover:bg-paramo-surface-2"
              >
                Retirar observación
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type ModalProps = {
  prospectos: Array<{ id: string; empresa: string }>;
  prospectoInicial?: string;
  onCreada: (o: ObservacionItem) => void;
  onCerrar: () => void;
};

/** Modal «Nueva observación» (as-is openObsModal). */
export function NuevaObservacionModal({
  prospectos,
  prospectoInicial,
  onCreada,
  onCerrar,
}: ModalProps) {
  const titleId = useId();
  const [prospectoId, setProspectoId] = useState(prospectoInicial ?? "");
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setCargando(true);
    setError(null);
    try {
      const res = await llamar<{ observacion: ObservacionItem }>("/api/observaciones", "POST", {
        prospecto_id: prospectoId || null,
        texto,
      });
      onCreada(res.observacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la observación.");
      setCargando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paramo-fg/40 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        className="flex w-full max-w-lg flex-col gap-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4 shadow-lg"
      >
        <h2 id={titleId} className="font-paramo-display text-xl font-bold text-paramo-fg">
          Nueva observación
        </h2>
        <div className="space-y-1">
          <label htmlFor="ob-prospecto" className="text-[11.5px] font-bold text-paramo-muted">
            Sobre
          </label>
          <select
            id="ob-prospecto"
            value={prospectoId}
            onChange={(e) => setProspectoId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Gestión general (sin prospecto)</option>
            {prospectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.empresa}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ob-texto" className="text-[11.5px] font-bold text-paramo-muted">
            Observación *
          </label>
          <textarea
            id="ob-texto"
            required
            rows={4}
            maxLength={2000}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué viste y qué esperas que haga el comercial"
            className={`${fieldClass} py-2`}
          />
        </div>
        {error ? (
          <p className="text-sm text-paramo-bad" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" disabled={cargando} className={btnPrimary}>
            {cargando ? "Enviando…" : "Enviar observación"}
          </button>
        </div>
      </form>
    </div>
  );
}
