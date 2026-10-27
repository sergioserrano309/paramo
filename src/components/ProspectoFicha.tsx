"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import {
  NuevaObservacionModal,
  ObservacionesLista,
} from "@/components/ObservacionesLista";
import { estadoCotizacion } from "@/config/cotizaciones";
import { MOTIVOS_PERDIDA } from "@/config/motivos-perdida";
import {
  ACT_TIPOS,
  CALIF_TXT,
  MOTIVOS_INACTIVO,
} from "@/config/prospectos";
import { can, canEditProspecto } from "@/lib/can";
import { canToggleCompromiso } from "@/lib/can";
import { fechaCorta, textoFecha } from "@/lib/fechas";
import { formatMoneyShort, todayBogota } from "@/lib/format";
import { formatCOP } from "@/lib/precios";
import type { Rol } from "@/config/roles";
import type { FichaProspecto } from "@/lib/types/ficha";
import type { ProspectoListItem, ProspectosCatalogos } from "@/lib/types/prospecto";

type Props = {
  prospectoId: string;
  catalogos: ProspectosCatalogos;
  userId: string;
  userRol: Rol;
  onCerrar: () => void;
  /** Se llama con el prospecto ya actualizado para que el listado de la página lo refleje. */
  onActualizado: (p: ProspectoListItem) => void;
  onEliminado: (id: string) => void;
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
  valor_mensual_estimado: string;
  notas: string;
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const secClass = "text-[11px] font-extrabold uppercase tracking-[0.09em] text-paramo-muted";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-paramo-line px-3 text-xs font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

function aDatos(p: ProspectoListItem): DatosForm {
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
    valor_mensual_estimado: p.valor_mensual_estimado ? String(p.valor_mensual_estimado) : "",
    notas: p.notas,
  };
}

/** Prospecto tal como lo muestran los listados (con próximo compromiso y observaciones). */
function aListado(f: FichaProspecto): ProspectoListItem {
  const proximo = f.compromisos.filter((c) => !c.hecho).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  return {
    ...f.prospecto,
    proximo_compromiso: proximo ? { fecha: proximo.fecha, titulo: proximo.titulo } : null,
    observaciones_abiertas: f.observaciones.filter((o) => o.estado === "abierta").length,
  };
}

async function llamar<T>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
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

export function ProspectoFicha({
  prospectoId,
  catalogos,
  userId,
  userRol,
  onCerrar,
  onActualizado,
  onEliminado,
}: Props) {
  const titleId = useId();
  const [ficha, setFicha] = useState<FichaProspecto | null>(null);
  const [datos, setDatos] = useState<DatosForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [actTipo, setActTipo] = useState<string>(ACT_TIPOS[0]);
  const [actTexto, setActTexto] = useState("");
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);
  const [confirmaInactivar, setConfirmaInactivar] = useState(false);
  const [motivoInactivo, setMotivoInactivo] = useState<string>(MOTIVOS_INACTIVO[0]);
  const [pidiendoMotivoPerdida, setPidiendoMotivoPerdida] = useState(false);
  const [modalObs, setModalObs] = useState(false);

  const aplicar = useCallback(
    (f: FichaProspecto) => {
      setFicha(f);
      setDatos(aDatos(f.prospecto));
      onActualizado(aListado(f));
    },
    [onActualizado],
  );

  const recargar = useCallback(async () => {
    const res = await llamar<{ ficha: FichaProspecto }>(`/api/prospectos/${prospectoId}`, "GET");
    aplicar(res.ficha);
  }, [prospectoId, aplicar]);

  useEffect(() => {
    let cancelado = false;
    setFicha(null);
    setError(null);
    llamar<{ ficha: FichaProspecto }>(`/api/prospectos/${prospectoId}`, "GET")
      .then((r) => {
        if (cancelado) return;
        setFicha(r.ficha);
        setDatos(aDatos(r.ficha.prospecto));
      })
      .catch((e) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el prospecto.");
      });
    return () => {
      cancelado = true;
    };
  }, [prospectoId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !modalObs && !pidiendoMotivoPerdida) onCerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar, modalObs, pidiendoMotivoPerdida]);

  /** Ejecuta una acción que devuelve la ficha ya actualizada. */
  async function accion(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
    mensaje?: string,
  ) {
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const res = await llamar<{ ficha: FichaProspecto }>(url, method, body);
      aplicar(res.ficha);
      if (mensaje) setAviso(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setCargando(false);
    }
  }

  async function cambiarEtapa(codigo: string, motivo?: string) {
    if (!ficha) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      await llamar<{ prospecto: ProspectoListItem }>(
        `/api/prospectos/${prospectoId}/etapa`,
        "PATCH",
        { etapa_codigo: codigo, motivo_perdida: motivo ?? "" },
      );
      await recargar();
      if (codigo === "ganado") setAviso(`¡${ficha.prospecto.empresa} ganado!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la etapa.");
    } finally {
      setCargando(false);
    }
  }

  async function marcarCompromiso(id: string, hecho: boolean) {
    setError(null);
    try {
      await llamar<{ ok: true }>(`/api/compromisos/${id}/hecho`, "POST", { hecho });
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el compromiso.");
    }
  }

  async function eliminar() {
    setError(null);
    setCargando(true);
    try {
      await llamar<{ ok: true }>(`/api/prospectos/${prospectoId}`, "DELETE");
      onEliminado(prospectoId);
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el prospecto.");
      setCargando(false);
    }
  }

  function guardarDatos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datos || !datos.empresa.trim()) {
      setError("La empresa es obligatoria.");
      return;
    }
    void accion(
      `/api/prospectos/${prospectoId}`,
      "PATCH",
      {
        tipo: "datos",
        ...datos,
        empresa: datos.empresa.trim(),
        canal_codigo: datos.canal_codigo || null,
        tipo_cliente_codigo: datos.tipo_cliente_codigo || null,
        fuente_codigo: datos.fuente_codigo || null,
        valor_mensual_estimado: datos.valor_mensual_estimado
          ? Number(datos.valor_mensual_estimado)
          : 0,
      },
      "Cambios guardados.",
    );
  }

  function registrarActividad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actTexto.trim()) return;
    void accion(
      `/api/prospectos/${prospectoId}/actividad`,
      "POST",
      { tipo: actTipo, texto: actTexto.trim() },
      "Actividad registrada.",
    ).then(() => setActTexto(""));
  }

  function set<K extends keyof DatosForm>(k: K, v: DatosForm[K]) {
    setDatos((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  const p = ficha?.prospecto ?? null;
  const ed = p ? canEditProspecto(userRol, userId, p.responsable_id) : false;
  const puedeAsignar = p ? ed || can(userRol, "asignar") : false;
  const off = p ? !p.activo : false;
  const etapas = [...catalogos.etapas].sort((a, b) => a.orden - b.orden);
  const idxActual = p ? etapas.findIndex((e) => e.codigo === p.etapa_codigo) : -1;
  const hoy = todayBogota();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-paramo-fg/40"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-2xl flex-col border-l border-paramo-line bg-paramo-surface shadow-lg"
      >
        <div className="flex items-start gap-3 border-b border-paramo-line px-4 py-3">
          <div className="mr-auto min-w-0">
            <h2 id={titleId} className="font-paramo-display text-xl font-bold text-paramo-fg">
              {p?.empresa ?? "Prospecto"}
            </h2>
            {p && ficha ? (
              <div className="text-xs text-paramo-muted">
                Creado {fechaCorta(p.creado_en.slice(0, 10))}
                {ficha.creado_por_nombre !== "—" ? ` por ${ficha.creado_por_nombre}` : ""}
                {p.etapa_desde ? ` · en esta etapa desde ${fechaCorta(p.etapa_desde)}` : ""}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-paramo-bad" role="alert">
              {error}
            </p>
          ) : null}
          {aviso ? (
            <p className="text-sm text-paramo-good" role="status">
              {aviso}
            </p>
          ) : null}
          {!ficha || !p || !datos ? (
            <p className="text-sm text-paramo-muted">{error ? "" : "Cargando…"}</p>
          ) : (
            <>
              {off ? (
                <p className="rounded-[10px] border border-paramo-line bg-paramo-surface-2 p-3 text-sm text-paramo-fg">
                  <b>Prospecto inactivo</b>
                  {ficha.inactivo_en ? ` desde ${fechaCorta(ficha.inactivo_en)}` : ""}
                  {ficha.motivo_inactivo ? ` · ${ficha.motivo_inactivo}` : ""}. No aparece en el
                  funnel ni en los indicadores.
                </p>
              ) : null}

              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-1">
                  <div className={secClass}>Calificación</div>
                  <div className="flex items-center gap-2">
                    <div role="group" aria-label={`Calificación ${p.calificacion} de 3`} className="flex">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={!ed || cargando}
                          aria-label={`${n} de 3: ${CALIF_TXT[n]}`}
                          title={CALIF_TXT[n]}
                          onClick={() =>
                            void accion(`/api/prospectos/${prospectoId}`, "PATCH", {
                              tipo: "calificacion",
                              // Como el as-is: tocar la estrella actual la quita.
                              calificacion: p.calificacion === n ? 0 : n,
                            })
                          }
                          className={`min-h-11 min-w-9 text-2xl leading-none disabled:cursor-not-allowed ${
                            n <= p.calificacion ? "text-paramo-olive" : "text-paramo-line"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-paramo-muted">{CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}</span>
                  </div>
                </div>
                <div className="min-w-[220px] max-w-xs flex-1 space-y-1">
                  <div className={secClass}>Responsable</div>
                  {puedeAsignar ? (
                    <select
                      aria-label="Responsable"
                      value={p.responsable_id}
                      disabled={cargando}
                      onChange={(e) =>
                        void accion(
                          `/api/prospectos/${prospectoId}`,
                          "PATCH",
                          { tipo: "responsable", responsable_id: e.target.value },
                          "Responsable actualizado.",
                        )
                      }
                      className={fieldClass}
                    >
                      {catalogos.responsables.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-paramo-fg">{p.responsable_nombre}</span>
                  )}
                </div>
              </div>

              <section className="space-y-2">
                <div className={secClass}>Etapa del funnel</div>
                <div className="flex flex-wrap gap-1.5">
                  {etapas.map((e, i) => {
                    const actual = e.codigo === p.etapa_codigo;
                    const pasada = !actual && p.etapa_codigo !== "perdido" && i < idxActual && e.codigo !== "perdido";
                    return (
                      <button
                        key={e.codigo}
                        type="button"
                        disabled={!ed || off || cargando || actual}
                        aria-current={actual ? "step" : undefined}
                        onClick={() =>
                          e.codigo === "perdido"
                            ? setPidiendoMotivoPerdida(true)
                            : void cambiarEtapa(e.codigo)
                        }
                        className={`min-h-9 rounded-full border px-3 text-xs font-bold disabled:cursor-not-allowed ${
                          actual
                            ? e.codigo === "perdido"
                              ? "border-paramo-rasp bg-paramo-rasp text-paramo-brand-ink"
                              : "border-paramo-brand bg-paramo-brand text-paramo-brand-ink"
                            : pasada
                              ? "border-paramo-teal text-paramo-teal-ink"
                              : "border-paramo-line text-paramo-muted hover:bg-paramo-surface-2"
                        }`}
                      >
                        {e.nombre}
                      </button>
                    );
                  })}
                </div>
                {p.etapa_codigo === "perdido" && p.motivo_perdida ? (
                  <p className="text-xs text-paramo-muted">Motivo: {p.motivo_perdida}</p>
                ) : null}
                {ed ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
                    {off ? (
                      <>
                        <button
                          type="button"
                          disabled={cargando}
                          className={`${btnSmall} bg-paramo-teal text-paramo-brand-ink hover:bg-paramo-teal`}
                          onClick={() =>
                            void accion(
                              `/api/prospectos/${prospectoId}/activo`,
                              "POST",
                              { activo: true },
                              "Prospecto reactivado.",
                            )
                          }
                        >
                          Reactivar prospecto
                        </button>
                        <span>Vuelve al funnel en la etapa {p.etapa_nombre}.</span>
                      </>
                    ) : confirmaInactivar ? (
                      <>
                        <span>Motivo:</span>
                        <select
                          aria-label="Motivo de inactivación"
                          value={motivoInactivo}
                          onChange={(e) => setMotivoInactivo(e.target.value)}
                          className={`${fieldClass} w-auto`}
                        >
                          {MOTIVOS_INACTIVO.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={cargando}
                          className={btnSmall}
                          onClick={() => {
                            setConfirmaInactivar(false);
                            void accion(
                              `/api/prospectos/${prospectoId}/activo`,
                              "POST",
                              { activo: false, motivo: motivoInactivo },
                              "Prospecto inactivado.",
                            );
                          }}
                        >
                          Confirmar inactivación
                        </button>
                        <button type="button" className={btnSmall} onClick={() => setConfirmaInactivar(false)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={cargando}
                          className={btnSmall}
                          onClick={() => setConfirmaInactivar(true)}
                        >
                          Inactivar prospecto
                        </button>
                        <span>Sale del funnel y de los indicadores; no se borra.</span>
                      </>
                    )}
                  </div>
                ) : null}
              </section>

              {ficha.observaciones.length || can(userRol, "observar") ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`${secClass} mr-auto`}>Observaciones del supervisor</span>
                    {can(userRol, "observar") ? (
                      <button type="button" className={btnSmall} onClick={() => setModalObs(true)}>
                        Observación
                      </button>
                    ) : null}
                  </div>
                  <ObservacionesLista
                    observaciones={ficha.observaciones}
                    userId={userId}
                    puedeAtender={can(userRol, "editar")}
                    puedeObservar={can(userRol, "observar")}
                    onActualizada={() => void recargar()}
                    onRetirada={() => void recargar()}
                  />
                </section>
              ) : null}

              {ed && !off ? (
                <section className="space-y-2 rounded-[10px] border border-paramo-line p-3">
                  <div className={secClass}>Registrar actividad</div>
                  <form className="space-y-2" onSubmit={registrarActividad}>
                    <div role="group" aria-label="Tipo de actividad" className="flex flex-wrap gap-1.5">
                      {ACT_TIPOS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={actTipo === t}
                          onClick={() => setActTipo(t)}
                          className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                            actTipo === t
                              ? "border-paramo-brand bg-paramo-brand text-paramo-brand-ink"
                              : "border-paramo-line text-paramo-muted hover:bg-paramo-surface-2"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label="¿Qué pasó?"
                        value={actTexto}
                        maxLength={500}
                        onChange={(e) => setActTexto(e.target.value)}
                        placeholder="¿Qué pasó? Ej. Pidió precios de 8-pack"
                        className={`${fieldClass} min-w-[220px] flex-1`}
                      />
                      <button type="submit" disabled={cargando || !actTexto.trim()} className={btnPrimary}>
                        Guardar
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`${secClass} mr-auto`}>Cotizaciones</span>
                  {ed && !off ? (
                    <Link href={`/cotizaciones?nueva=1&prospecto=${prospectoId}`} className={btnSmall}>
                      Nueva cotización
                    </Link>
                  ) : null}
                </div>
                {ficha.cotizaciones.length ? (
                  <ul className="divide-y divide-paramo-line">
                    {ficha.cotizaciones.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/cotizaciones?abrir=${c.id}`}
                            className="font-bold text-paramo-teal-ink hover:underline"
                          >
                            {c.numero}
                          </Link>
                          <div className="text-xs text-paramo-muted">
                            {estadoCotizacion(c.estado).nombre} · {fechaCorta(c.fecha)}
                            {c.desc_pct ? ` · desc. ${c.desc_pct}%` : ""}
                          </div>
                        </div>
                        <b className="text-paramo-fg">{formatCOP(c.total)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-paramo-muted">Sin cotizaciones.</p>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`${secClass} mr-auto`}>Compromisos</span>
                  {(ed || can(userRol, "asignar")) && !off ? (
                    <Link href={`/compromisos?nuevo=1&prospecto=${prospectoId}`} className={btnSmall}>
                      {ed ? "Agendar" : "Asignar tarea"}
                    </Link>
                  ) : null}
                </div>
                {ficha.compromisos.length ? (
                  <ul className="divide-y divide-paramo-line">
                    {ficha.compromisos.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 py-2">
                        <button
                          type="button"
                          disabled={
                            !canToggleCompromiso(userRol, userId, {
                              creadoPor: c.creado_por,
                              responsableId: c.responsable_id,
                              responsableRol: c.responsable_rol,
                            })
                          }
                          aria-pressed={c.hecho}
                          aria-label={c.hecho ? "Marcar pendiente" : "Marcar hecho"}
                          onClick={() => void marcarCompromiso(c.id, !c.hecho)}
                          className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                            c.hecho
                              ? "border-paramo-teal bg-paramo-teal text-paramo-brand-ink"
                              : "border-paramo-line text-transparent hover:border-paramo-teal"
                          }`}
                        >
                          ✓
                        </button>
                        <div className={`min-w-0 flex-1 ${c.hecho ? "opacity-60" : ""}`}>
                          <div className="text-sm font-medium text-paramo-fg">{c.titulo}</div>
                          <div className="text-xs text-paramo-muted">
                            {c.tipo} · {c.responsable_nombre}
                            {c.asignado ? " · Asignada por supervisor" : ""}
                          </div>
                        </div>
                        <span
                          className={`text-xs ${
                            !c.hecho && c.fecha < hoy
                              ? "font-bold text-paramo-bad"
                              : "text-paramo-muted"
                          }`}
                        >
                          {textoFecha(c.fecha)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-paramo-muted">Sin compromisos. Agenda el próximo paso.</p>
                )}
              </section>

              {ficha.productos.length ? (
                <section className="space-y-2">
                  <div className={secClass}>Productos de interés</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ficha.productos.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={x.interesado}
                        disabled={!ed || cargando}
                        onClick={() =>
                          void accion(`/api/prospectos/${prospectoId}/interes`, "POST", {
                            producto_id: x.id,
                            interesado: !x.interesado,
                          })
                        }
                        className={`min-h-9 rounded-full border px-3 text-xs font-bold disabled:cursor-not-allowed ${
                          x.interesado
                            ? "border-paramo-teal bg-paramo-teal-soft text-paramo-teal-ink"
                            : "border-paramo-line text-paramo-muted hover:bg-paramo-surface-2"
                        }`}
                      >
                        {x.nombre}
                        {x.estado !== "activo" ? ` · ${x.estado === "desarrollo" ? "en desarrollo" : x.estado}` : ""}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <form className="space-y-3" onSubmit={guardarDatos} noValidate>
                <fieldset disabled={!ed || cargando} className="grid gap-3 sm:grid-cols-2">
                  <legend className={`${secClass} mb-1`}>Datos</legend>
                  <div className="space-y-1 sm:col-span-2">
                    <label htmlFor="fp-empresa" className={labelClass}>
                      Empresa *
                    </label>
                    <input
                      id="fp-empresa"
                      required
                      maxLength={200}
                      value={datos.empresa}
                      onChange={(e) => set("empresa", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  {(
                    [
                      ["nit", "NIT", 40, "text"],
                      ["contacto", "Contacto", 120, "text"],
                      ["cargo", "Cargo", 120, "text"],
                      ["telefono", "Teléfono", 40, "tel"],
                      ["email", "Correo", 254, "email"],
                      ["ciudad", "Ciudad", 120, "text"],
                    ] as Array<[keyof DatosForm, string, number, string]>
                  ).map(([k, etiqueta, max, tipo]) => (
                    <div key={k} className="space-y-1">
                      <label htmlFor={`fp-${k}`} className={labelClass}>
                        {etiqueta}
                      </label>
                      <input
                        id={`fp-${k}`}
                        type={tipo}
                        maxLength={max}
                        value={datos[k]}
                        onChange={(e) => set(k, e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label htmlFor="fp-canal" className={labelClass}>
                      Canal
                    </label>
                    <select
                      id="fp-canal"
                      value={datos.canal_codigo}
                      onChange={(e) => set("canal_codigo", e.target.value)}
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
                    <label htmlFor="fp-tipo" className={labelClass}>
                      Tipo de cliente (precios)
                    </label>
                    <select
                      id="fp-tipo"
                      value={datos.tipo_cliente_codigo}
                      onChange={(e) => set("tipo_cliente_codigo", e.target.value)}
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
                    <label htmlFor="fp-fuente" className={labelClass}>
                      ¿Cómo llegó?
                    </label>
                    <select
                      id="fp-fuente"
                      value={datos.fuente_codigo}
                      onChange={(e) => set("fuente_codigo", e.target.value)}
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
                    <label htmlFor="fp-valor" className={labelClass}>
                      Venta mensual estimada (COP)
                    </label>
                    <input
                      id="fp-valor"
                      type="number"
                      min={0}
                      step={10000}
                      inputMode="numeric"
                      value={datos.valor_mensual_estimado}
                      onChange={(e) => set("valor_mensual_estimado", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label htmlFor="fp-notas" className={labelClass}>
                      Notas
                    </label>
                    <textarea
                      id="fp-notas"
                      rows={3}
                      maxLength={4000}
                      value={datos.notas}
                      onChange={(e) => set("notas", e.target.value)}
                      className={`${fieldClass} min-h-[88px] py-2`}
                    />
                  </div>
                </fieldset>
                {ed ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {confirmaBorrar ? (
                      <>
                        <span className="mr-auto text-sm text-paramo-muted">
                          ¿Eliminar definitivamente? Si solo dejó de ser prospecto, mejor inactívalo.
                        </span>
                        <button
                          type="button"
                          disabled={cargando}
                          className={`${btnGhost} text-paramo-bad`}
                          onClick={eliminar}
                        >
                          Sí, eliminar
                        </button>
                        <button type="button" className={btnGhost} onClick={() => setConfirmaBorrar(false)}>
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={cargando}
                          className={`${btnGhost} mr-auto text-paramo-bad`}
                          onClick={() => setConfirmaBorrar(true)}
                        >
                          Eliminar
                        </button>
                        <button type="submit" disabled={cargando} className={btnPrimary}>
                          Guardar cambios
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </form>

              {ficha.actividad.length ? (
                <section className="space-y-2">
                  <div className={secClass}>Historial</div>
                  <ul className="space-y-2">
                    {ficha.actividad.map((a) => (
                      <li key={a.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 text-sm">
                        <span className="text-xs text-paramo-muted">
                          {fechaCorta(a.fecha)}
                          <br />
                          {a.tipo}
                        </span>
                        <span className="text-paramo-fg">
                          {a.texto}
                          {a.usuario_nombre !== "—" ? (
                            <span className="text-xs text-paramo-muted"> · {a.usuario_nombre}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <p className="text-xs text-paramo-muted">
                Venta mensual: {p.valor_mensual_estimado ? formatMoneyShort(p.valor_mensual_estimado) : "—"}
              </p>
            </>
          )}
        </div>
      </div>

      {pidiendoMotivoPerdida && p ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-paramo-fg/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPidiendoMotivoPerdida(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Motivo de pérdida"
            className="w-full max-w-md space-y-4 rounded-[10px] border border-paramo-line bg-paramo-surface p-5 shadow-lg"
          >
            <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
              ¿Por qué se perdió {p.empresa}?
            </h3>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_PERDIDA.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="rounded-full border border-paramo-line px-3 py-2 text-xs font-semibold text-paramo-muted hover:border-paramo-brand hover:bg-paramo-brand-soft hover:text-paramo-brand"
                  onClick={() => {
                    setPidiendoMotivoPerdida(false);
                    void cambiarEtapa("perdido", m);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" className={btnGhost} onClick={() => setPidiendoMotivoPerdida(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalObs && p ? (
        <NuevaObservacionModal
          prospectos={[{ id: p.id, empresa: p.empresa }]}
          prospectoInicial={p.id}
          onCerrar={() => setModalObs(false)}
          onCreada={() => {
            setModalObs(false);
            void recargar();
          }}
        />
      ) : null}
    </div>
  );
}
