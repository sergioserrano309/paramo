"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  ATAJOS_FECHA,
  DIAS_CUMPLIMIENTO,
  TIPOS_COMPROMISO,
} from "@/config/compromisos";
import type { Rol } from "@/config/roles";
import {
  puedeEditarCompromiso,
  puedeMarcarCompromiso,
} from "@/lib/compromisos-permisos";
import { sumarDias, textoFecha } from "@/lib/fechas";
import { initials, todayBogota } from "@/lib/format";
import type { CompromisoItem, PersonaOption } from "@/lib/types/compromiso";

type ProspectoOpcion = { id: string; empresa: string; activo: boolean };

type Props = {
  initialCompromisos: CompromisoItem[];
  cargaFallida: boolean;
  personas: PersonaOption[];
  prospectos: ProspectoOpcion[];
  userId: string;
  rol: Rol;
  puedeCrear: boolean;
  /** Cambia con cada pulsación de «C» o enlace `?nuevo=…`; si no está vacío, abre el alta. */
  nuevoToken: string;
  prospectoInicial: string;
};

type Filtro = "pendientes" | "vencidos" | "hoy" | "semana" | "asignadas" | "hechos";

type FormState = {
  titulo: string;
  tipo: string;
  fecha: string;
  prospecto_id: string;
  notas: string;
  responsable_id: string;
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60";

export function CompromisosPanel({
  initialCompromisos,
  cargaFallida,
  personas,
  prospectos,
  userId,
  rol,
  puedeCrear,
  nuevoToken,
  prospectoInicial,
}: Props) {
  const titleId = useId();
  const esSupervisor = rol === "supervisor";
  const hoy = todayBogota();
  // As-is vendorId: a quién se asigna por defecto cuando el supervisor crea una tarea.
  // Debe declararse antes de los `useState`: el estado inicial del formulario lo usa.
  const vendedorDefault = personas.find((p) => p.rol !== "supervisor")?.id ?? userId;

  const [compromisos, setCompromisos] = useState(initialCompromisos);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  // As-is: el comercial arranca viendo lo suyo; el supervisor, todos los responsables.
  const [resp, setResp] = useState<string>(esSupervisor ? "" : userId);
  // null = cerrado; "nuevo" = alta; uuid = edición.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => formVacio());
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setCompromisos(initialCompromisos);
  }, [initialCompromisos]);

  // Atajo «C» o enlace con `?nuevo=…` (Supervisión, ficha del prospecto): abre el alta, con
  // el prospecto si viene.
  useEffect(() => {
    if (nuevoToken && puedeCrear) {
      setForm({ ...formVacio(), prospecto_id: prospectoInicial });
      setAbierto("nuevo");
    }
    // formVacio depende solo de props estables; el token es lo que dispara la apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevoToken, puedeCrear, prospectoInicial]);

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  function formVacio(): FormState {
    return {
      titulo: "",
      tipo: "Llamada",
      fecha: sumarDias(todayBogota(), 1),
      prospecto_id: "",
      notas: "",
      responsable_id: esSupervisor ? vendedorDefault : userId,
    };
  }

  const actual =
    abierto && abierto !== "nuevo" ? (compromisos.find((c) => c.id === abierto) ?? null) : null;
  const esNuevo = abierto === "nuevo";

  function cerrar() {
    setAbierto(null);
    setError(null);
  }

  function abrirNuevo() {
    setError(null);
    setAviso(null);
    setForm(formVacio());
    setAbierto("nuevo");
  }

  function abrirEdicion(c: CompromisoItem) {
    setError(null);
    setAviso(null);
    setForm({
      titulo: c.titulo,
      tipo: c.tipo,
      fecha: c.fecha,
      prospecto_id: c.prospecto_id ?? "",
      notas: c.notas,
      responsable_id: c.responsable_id,
    });
    setAbierto(c.id);
  }

  function guardarEnLista(c: CompromisoItem) {
    setCompromisos((prev) =>
      prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c],
    );
  }

  async function llamar<T>(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) throw new Error(json?.error ?? "No se pudo completar la acción.");
    return json;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.titulo.trim()) {
      setError("Escribe qué hay que hacer.");
      return;
    }
    setCargando(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        fecha: form.fecha,
        prospecto_id: form.prospecto_id || null,
        notas: form.notas,
        responsable_id: esSupervisor ? form.responsable_id : undefined,
      };
      const res = esNuevo
        ? await llamar<{ compromiso: CompromisoItem }>("/api/compromisos", "POST", payload)
        : await llamar<{ compromiso: CompromisoItem }>(
            `/api/compromisos/${actual?.id}`,
            "PATCH",
            payload,
          );
      guardarEnLista(res.compromiso);
      setAbierto(null);
      setAviso(
        !esNuevo
          ? "Compromiso actualizado."
          : res.compromiso.asignado
            ? `Tarea asignada a ${res.compromiso.responsable_nombre}.`
            : "Compromiso agendado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el compromiso.");
    } finally {
      setCargando(false);
    }
  }

  async function marcar(c: CompromisoItem) {
    setError(null);
    try {
      const res = await llamar<{ compromiso: CompromisoItem }>(
        `/api/compromisos/${c.id}/hecho`,
        "POST",
        { hecho: !c.hecho },
      );
      guardarEnLista(res.compromiso);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el compromiso.");
    }
  }

  async function eliminar() {
    if (!actual) return;
    setCargando(true);
    setError(null);
    try {
      await llamar<{ ok: true }>(`/api/compromisos/${actual.id}`, "DELETE");
      setCompromisos((prev) => prev.filter((c) => c.id !== actual.id));
      setAbierto(null);
      setAviso("Compromiso eliminado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el compromiso.");
    } finally {
      setCargando(false);
    }
  }

  const base = useMemo(
    () => compromisos.filter((c) => !resp || c.responsable_id === resp),
    [compromisos, resp],
  );
  const pend = base.filter((c) => !c.hecho);
  const semanaFin = sumarDias(hoy, 7);
  const conteo: Record<Filtro, number> = {
    vencidos: pend.filter((c) => c.fecha < hoy).length,
    hoy: pend.filter((c) => c.fecha === hoy).length,
    semana: pend.filter((c) => c.fecha >= hoy && c.fecha <= semanaFin).length,
    pendientes: pend.length,
    asignadas: pend.filter((c) => c.asignado).length,
    hechos: base.filter((c) => c.hecho).length,
  };

  let lista: CompromisoItem[];
  if (filtro === "vencidos") lista = pend.filter((c) => c.fecha < hoy);
  else if (filtro === "hoy") lista = pend.filter((c) => c.fecha === hoy);
  else if (filtro === "semana") lista = pend.filter((c) => c.fecha >= hoy && c.fecha <= semanaFin);
  else if (filtro === "asignadas") lista = pend.filter((c) => c.asignado);
  else if (filtro === "hechos") lista = base.filter((c) => c.hecho);
  else lista = pend;
  lista = [...lista].sort((a, b) =>
    filtro === "hechos"
      ? (b.hecho_en ?? b.fecha).localeCompare(a.hecho_en ?? a.fecha)
      : a.fecha.localeCompare(b.fecha),
  );
  if (filtro === "hechos") lista = lista.slice(0, 100);

  const desde30 = sumarDias(hoy, -DIAS_CUMPLIMIENTO);
  const ventana = base.filter((c) => c.fecha >= desde30 && c.fecha <= hoy);
  const cumplidos = ventana.filter((c) => c.hecho).length;
  const personaResp = personas.find((p) => p.id === resp);

  const filtros: Array<[Filtro, string]> = [
    ["pendientes", "Pendientes"],
    ["vencidos", "Vencidos"],
    ["hoy", "Hoy"],
    ["semana", "7 días"],
    ["asignadas", esSupervisor ? "Asignadas por mí" : "Asignadas"],
    ["hechos", "Hechos"],
  ];

  // Opciones del selector de responsable (as-is respSel).
  const opcionesResp = personas.filter((p) => esSupervisor || p.rol !== "supervisor");

  function etiquetaGrupo(c: CompromisoItem): string {
    if (c.hecho) return "Hechos";
    if (c.fecha < hoy) return "Vencidos";
    if (c.fecha === hoy) return "Hoy";
    if (c.fecha === sumarDias(hoy, 1)) return "Mañana";
    if (c.fecha <= semanaFin) return "Próximos 7 días";
    return "Más adelante";
  }

  let grupoActual = "";
  const prospectosForm = prospectos.filter((p) => p.activo || p.id === form.prospecto_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">Compromisos</h1>
          <p className="text-sm text-paramo-muted">
            {ventana.length
              ? `Cumplimiento últimos ${DIAS_CUMPLIMIENTO} días${personaResp ? ` · ${personaResp.nombre}` : ""}: ${Math.round((cumplidos / ventana.length) * 100)}% (${cumplidos} de ${ventana.length})`
              : "Llamadas, visitas, muestras y cotizaciones pendientes"}
          </p>
        </header>
        {puedeCrear ? (
          <button type="button" onClick={abrirNuevo} className={btnPrimary}>
            {esSupervisor ? "Nuevo compromiso" : "Compromiso"}
          </button>
        ) : null}
      </div>

      {aviso && !abierto ? (
        <p className="text-sm text-paramo-good" role="status">
          {aviso}
        </p>
      ) : null}
      {error && !abierto ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}
      {cargaFallida ? (
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudieron cargar los compromisos. Revisa que la migración de compromisos esté
          aplicada en Supabase.
        </p>
      ) : null}

      {esSupervisor ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {personas.map((p) => {
            const mios = compromisos.filter((c) => c.responsable_id === p.id);
            const pe = mios.filter((c) => !c.hecho);
            const ve = pe.filter((c) => c.fecha < hoy);
            const t30 = mios.filter((c) => c.fecha >= desde30 && c.fecha <= hoy);
            const ok30 = t30.filter((c) => c.hecho);
            const aTiempo = ok30.filter((c) => (c.hecho_en ?? "") <= c.fecha).length;
            const proximo = [...pe].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={resp === p.id}
                onClick={() => setResp(resp === p.id ? "" : p.id)}
                className={`space-y-2 rounded-[10px] border bg-paramo-surface p-3 text-left hover:border-paramo-teal ${
                  resp === p.id ? "border-paramo-teal" : "border-paramo-line"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Avatar nombre={p.nombre} rol={p.rol} />
                  <b className="text-paramo-fg">{p.nombre}</b>
                  <span className="text-xs text-paramo-muted">
                    {p.rol === "supervisor" ? "Supervisor" : "Vendedor"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <Stat valor={String(pe.length)} texto="pendientes" />
                  <Stat valor={String(ve.length)} texto="vencidos" alerta={ve.length > 0} />
                  <Stat
                    valor={t30.length ? `${Math.round((ok30.length / t30.length) * 100)}%` : "—"}
                    texto="cumplido 30 d"
                  />
                  <Stat
                    valor={ok30.length ? `${Math.round((aTiempo / ok30.length) * 100)}%` : "—"}
                    texto="a tiempo"
                  />
                </div>
                <div className="text-xs text-paramo-muted">
                  {proximo
                    ? `Próximo: ${textoFecha(proximo.fecha)} · ${proximo.titulo}`
                    : "Sin pendientes"}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filtro"
          className="inline-flex flex-wrap gap-1 rounded-full border border-paramo-line bg-paramo-surface p-1"
        >
          {filtros.map(([k, n]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filtro === k}
              onClick={() => setFiltro(k)}
              className={`min-h-9 rounded-full px-3 text-xs font-bold ${
                filtro === k
                  ? "bg-paramo-brand text-paramo-brand-ink"
                  : "text-paramo-muted hover:bg-paramo-surface-2"
              }`}
            >
              {n}
              {conteo[k] ? (
                <span
                  className={`ml-1 rounded-full px-1.5 text-[10px] ${
                    k === "vencidos" ? "bg-paramo-bad text-paramo-brand-ink" : "bg-paramo-surface-2"
                  }`}
                >
                  {conteo[k]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <select
          aria-label="Responsable"
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          className={`${fieldClass} max-w-xs`}
        >
          <option value="">Todos los responsables</option>
          {opcionesResp.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.id === userId ? " (yo)" : ""}
            </option>
          ))}
        </select>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-8 text-center">
          <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
            {filtro === "vencidos" ? "Nada vencido" : "Sin compromisos aquí"}
          </h3>
          <p className="mt-1 text-sm text-paramo-muted">
            {filtro === "hechos"
              ? "Los compromisos cumplidos aparecerán aquí."
              : "Agrega uno con el botón de arriba."}
          </p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-paramo-line bg-paramo-surface">
          {lista.map((c) => {
            const grupo = etiquetaGrupo(c);
            const cabecera = grupo !== grupoActual;
            grupoActual = grupo;
            const puedeMarcar = puedeMarcarCompromiso(rol, userId, c);
            const puedeEditar = puedeEditarCompromiso(rol, userId, c);
            const mostrarResp = esSupervisor || c.responsable_id !== userId;
            const tarde = c.hecho && c.hecho_en && c.hecho_en > c.fecha;
            return (
              <div key={c.id}>
                {cabecera ? (
                  <div
                    className={`border-b border-paramo-line px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide ${
                      grupo === "Vencidos" ? "text-paramo-bad" : "text-paramo-muted"
                    }`}
                  >
                    {grupo}
                  </div>
                ) : null}
                <div
                  className={`flex items-start gap-3 border-b border-paramo-line px-3 py-3 last:border-b-0 ${
                    c.hecho ? "opacity-60" : ""
                  }`}
                >
                  <button
                    type="button"
                    disabled={!puedeMarcar}
                    onClick={() => marcar(c)}
                    aria-label={c.hecho ? "Marcar pendiente" : "Marcar hecho"}
                    aria-pressed={c.hecho}
                    className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                      c.hecho
                        ? "border-paramo-teal bg-paramo-teal text-paramo-brand-ink"
                        : "border-paramo-line text-transparent hover:border-paramo-teal"
                    }`}
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-paramo-fg">{c.titulo}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
                      <span className="rounded-full border border-paramo-line px-2 py-0.5">
                        {c.tipo}
                      </span>
                      {mostrarResp ? (
                        <span className="inline-flex items-center gap-1">
                          <Avatar nombre={c.responsable_nombre} rol={c.responsable_rol} pequeno />
                          {c.responsable_nombre}
                        </span>
                      ) : null}
                      {c.asignado ? (
                        <span className="rounded-full bg-paramo-brand-soft px-2 py-0.5 font-bold text-paramo-brand">
                          Asignada por supervisor
                        </span>
                      ) : null}
                      {c.prospecto_empresa ? <span>{c.prospecto_empresa}</span> : null}
                      {c.notas ? <span>{c.notas}</span> : null}
                      {c.hecho && c.hecho_en ? (
                        <span>
                          cumplido {textoFecha(c.hecho_en)}
                          {tarde ? <span className="text-paramo-bad"> (tarde)</span> : null}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[12.5px] ${
                        c.hecho
                          ? "text-paramo-muted"
                          : c.fecha < hoy
                            ? "font-bold text-paramo-bad"
                            : c.fecha === hoy
                              ? "font-bold text-paramo-warn"
                              : "text-paramo-muted"
                      }`}
                    >
                      {textoFecha(c.fecha)}
                    </span>
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={() => abrirEdicion(c)}
                        className={`${btnSmall} text-paramo-muted hover:bg-paramo-surface-2`}
                      >
                        Editar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paramo-fg/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onSubmit={onSubmit}
            noValidate
            className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-[10px] border border-paramo-line bg-paramo-surface p-4 shadow-lg"
          >
            <h2 id={titleId} className="font-paramo-display text-xl font-bold text-paramo-fg">
              {esNuevo ? "Nuevo compromiso" : "Editar compromiso"}
            </h2>

            {esSupervisor ? (
              <div className="space-y-1">
                <label htmlFor="c-resp" className={labelClass}>
                  ¿Quién lo hace?
                </label>
                <select
                  id="c-resp"
                  value={form.responsable_id}
                  onChange={(e) => setForm((s) => ({ ...s, responsable_id: e.target.value }))}
                  className={fieldClass}
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.id === userId
                        ? " (yo)"
                        : ` · ${p.rol === "supervisor" ? "Supervisor" : "Vendedor"}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-1">
              <label htmlFor="c-titulo" className={labelClass}>
                ¿Qué hay que hacer? *
              </label>
              <input
                id="c-titulo"
                required
                maxLength={200}
                autoFocus
                value={form.titulo}
                onChange={(e) => setForm((s) => ({ ...s, titulo: e.target.value }))}
                placeholder="Ej. Llevar muestras de Piña Bites"
                className={fieldClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="c-tipo" className={labelClass}>
                  Tipo
                </label>
                <select
                  id="c-tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
                  className={fieldClass}
                >
                  {TIPOS_COMPROMISO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="c-fecha" className={labelClass}>
                  Fecha límite *
                </label>
                <input
                  id="c-fecha"
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => setForm((s) => ({ ...s, fecha: e.target.value }))}
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ATAJOS_FECHA.map((a) => (
                <button
                  key={a.etiqueta}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, fecha: sumarDias(hoy, a.dias) }))}
                  className={`${btnSmall} border border-paramo-line text-paramo-fg hover:bg-paramo-surface-2`}
                >
                  {a.etiqueta}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <label htmlFor="c-prospecto" className={labelClass}>
                Prospecto / cliente
              </label>
              <select
                id="c-prospecto"
                value={form.prospecto_id}
                onChange={(e) => setForm((s) => ({ ...s, prospecto_id: e.target.value }))}
                className={fieldClass}
              >
                <option value="">— Ninguno —</option>
                {prospectosForm.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.empresa}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="c-notas" className={labelClass}>
                Notas
              </label>
              <input
                id="c-notas"
                maxLength={500}
                value={form.notas}
                onChange={(e) => setForm((s) => ({ ...s, notas: e.target.value }))}
                className={fieldClass}
              />
            </div>

            {error ? (
              <p className="text-sm text-paramo-bad" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {actual && puedeEditarCompromiso(rol, userId, actual) ? (
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={cargando}
                  className={`${btnGhost} mr-auto text-paramo-bad`}
                >
                  Eliminar
                </button>
              ) : null}
              <button type="button" onClick={cerrar} className={btnGhost}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando} className={btnPrimary}>
                {cargando
                  ? "Guardando…"
                  : !esNuevo
                    ? "Guardar"
                    : esSupervisor && form.responsable_id !== userId
                      ? "Asignar"
                      : "Agendar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ nombre, rol, pequeno }: { nombre: string; rol: Rol; pequeno?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${
        pequeno ? "size-5 text-[9px]" : "size-8 text-xs"
      } ${
        rol === "supervisor"
          ? "bg-paramo-teal-soft text-paramo-teal-ink"
          : "bg-paramo-brand-soft text-paramo-brand"
      }`}
    >
      {initials(nombre)}
    </span>
  );
}

function Stat({ valor, texto, alerta }: { valor: string; texto: string; alerta?: boolean }) {
  return (
    <div>
      <b className={`block text-base ${alerta ? "text-paramo-bad" : "text-paramo-fg"}`}>{valor}</b>
      <span className="text-[10px] leading-tight text-paramo-muted">{texto}</span>
    </div>
  );
}
