"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CompromisoFechaText } from "@/components/CompromisoFechaText";
import { ProspectoDetalleDrawer } from "@/components/ProspectoDetalleDrawer";
import { WhoChip } from "@/components/WhoChip";
import {
  ATAJOS_FECHA_COMPROMISO,
  TIPOS_COMPROMISO,
  type TipoCompromiso,
} from "@/config/compromisos";
import { MOTIVOS_PERDIDA } from "@/config/motivos-perdida";
import { ROL_LABEL, type Rol } from "@/config/roles";
import {
  etiquetaFiltro,
  etiquetaGrupo,
  FILTROS_AGENDA,
  grupoDe,
  ordenarAgenda,
  partirGrupos,
  pasaFiltro,
  statsDeGrupo,
  subtituloAgenda,
  vacioAgenda,
  type FiltroAgenda,
  type GrupoAgenda,
} from "@/lib/compromisos-agenda";
import {
  canEditCompromiso,
  canEditProspecto,
  canToggleCompromiso,
} from "@/lib/can";
import { cn } from "@/lib/cn";
import { addDaysYmd, todayBogota } from "@/lib/format";
import type {
  CompromisoAgendaItem,
  ProspectoContactoActualizado,
} from "@/lib/types/compromiso";
import type {
  EtapaCatalogo,
  ProspectoListItem,
  ResponsableOption,
} from "@/lib/types/prospecto";

type CompromisosPanelProps = {
  initialCompromisos: CompromisoAgendaItem[];
  loadError: boolean;
  prospectos: ProspectoListItem[];
  etapas: EtapaCatalogo[];
  responsables: ResponsableOption[];
  canCreate: boolean;
  userId: string;
  userRol: Rol;
};

type EditorState =
  | { mode: "new" }
  | { mode: "edit"; compromiso: CompromisoAgendaItem };

type SaveBody = {
  titulo: string;
  tipo: string;
  fecha: string;
  prospecto_id: string | null;
  notas: string;
  responsable_id?: string;
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const btnPri =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

function accessDe(c: CompromisoAgendaItem) {
  return {
    creadoPor: c.creado_por,
    responsableId: c.responsable_id,
    responsableRol: c.responsable_rol,
  };
}

export function CompromisosPanel({
  initialCompromisos,
  loadError,
  prospectos: initialProspectos,
  etapas,
  responsables,
  canCreate,
  userId,
  userRol,
}: CompromisosPanelProps) {
  const router = useRouter();
  const detailTitleId = useId();
  const [compromisos, setCompromisos] = useState(initialCompromisos);
  const [prospectos, setProspectos] = useState(initialProspectos);
  const [filtro, setFiltro] = useState<FiltroAgenda>("pendientes");
  const [grupo, setGrupo] = useState<GrupoAgenda | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lostForId, setLostForId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const hoy = todayBogota();
  const supervisor = userRol === "supervisor";
  const base = grupo
    ? compromisos.filter((c) => grupoDe(c) === grupo)
    : compromisos;
  const coinciden = base.filter((c) =>
    pasaFiltro(c, filtro, hoy, userId, userRol),
  );
  const ordenados = ordenarAgenda(coinciden, filtro);
  const grupos = partirGrupos(ordenados, filtro, hoy);
  const vacio = vacioAgenda(filtro);
  const subtitulo = subtituloAgenda(
    base,
    hoy,
    grupo ? etiquetaGrupo(grupo) : null,
  );

  const counts = Object.fromEntries(
    FILTROS_AGENDA.map((f) => [
      f,
      base.filter((c) => pasaFiltro(c, f, hoy, userId, userRol)).length,
    ]),
  ) as Record<FiltroAgenda, number>;

  const prospectById = new Map(prospectos.map((p) => [p.id, p]));
  const openProspecto = openId ? (prospectById.get(openId) ?? null) : null;
  const lostProspecto = lostForId
    ? (prospectById.get(lostForId) ?? null)
    : null;
  const etapaIndex = new Map(etapas.map((e, i) => [e.codigo, i]));

  function upsert(item: CompromisoAgendaItem) {
    setCompromisos((prev) => {
      const i = prev.findIndex((c) => c.id === item.id);
      if (i === -1) return [item, ...prev];
      const next = prev.slice();
      next[i] = item;
      return next;
    });
  }

  function applyContacto(contacto: ProspectoContactoActualizado | null) {
    if (!contacto) return;
    setProspectos((prev) =>
      prev.map((p) =>
        p.id === contacto.id
          ? { ...p, ultimo_contacto: contacto.ultimo_contacto }
          : p,
      ),
    );
  }

  async function onToggle(c: CompromisoAgendaItem) {
    if (!canToggleCompromiso(userRol, userId, accessDe(c)) || busyId) return;
    setError(null);
    setOk(null);
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/compromisos/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hecho: !c.hecho }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        compromiso?: CompromisoAgendaItem;
        prospecto_contacto?: ProspectoContactoActualizado | null;
      } | null;
      if (!res.ok || !body?.compromiso) {
        throw new Error(body?.error ?? "No se pudo guardar el compromiso.");
      }
      upsert(body.compromiso);
      applyContacto(body.prospecto_contacto ?? null);
      if (body.compromiso.hecho) setOk("Compromiso cumplido");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el compromiso.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onSave(input: SaveBody, editingId: string | null) {
    setError(null);
    setOk(null);
    const res = await fetch(
      editingId ? `/api/compromisos/${editingId}` : "/api/compromisos",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      compromiso?: CompromisoAgendaItem;
    } | null;
    if (!res.ok || !body?.compromiso) {
      throw new Error(body?.error ?? "No se pudo guardar el compromiso.");
    }
    upsert(body.compromiso);
    setEditor(null);
    if (!editingId && body.compromiso.asignado) {
      setOk(`Tarea asignada a ${body.compromiso.responsable_nombre}`);
    } else if (!editingId) {
      setOk("Compromiso agendado");
    } else {
      setOk("Compromiso actualizado");
    }
    router.refresh();
  }

  async function onDelete(id: string) {
    setError(null);
    setOk(null);
    const res = await fetch(`/api/compromisos/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!res.ok) {
      throw new Error(body?.error ?? "No se pudo eliminar el compromiso.");
    }
    setCompromisos((prev) => prev.filter((c) => c.id !== id));
    setEditor(null);
    setOk("Compromiso eliminado");
    router.refresh();
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

  async function moveToStage(id: string, etapa_codigo: string, motivo?: string) {
    const p = prospectById.get(id);
    if (!p || p.etapa_codigo === etapa_codigo) return;
    if (!canEditProspecto(userRol, userId, p.responsable_id)) {
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
      setProspectos((prev) => prev.map((x) => (x.id === id ? updated : x)));
      if (etapa_codigo === "ganado") setOk(`${updated.empresa} ganado`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar la etapa.",
      );
    } finally {
      setMovingId(null);
    }
  }

  function toggleGrupo(next: GrupoAgenda) {
    setGrupo((current) => (current === next ? null : next));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="min-w-0 space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
            Compromisos
          </h1>
          <p className="text-sm text-paramo-muted">{subtitulo}</p>
        </header>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditor({ mode: "new" });
            }}
            className={btnPri}
          >
            + Nuevo compromiso
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

      {supervisor ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TarjetaGrupo
            grupo="comercial"
            selected={grupo === "comercial"}
            items={compromisos.filter((c) => grupoDe(c) === "comercial")}
            hoy={hoy}
            onClick={() => toggleGrupo("comercial")}
          />
          <TarjetaGrupo
            grupo="supervisor"
            selected={grupo === "supervisor"}
            items={compromisos.filter((c) => grupoDe(c) === "supervisor")}
            hoy={hoy}
            onClick={() => toggleGrupo("supervisor")}
          />
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtro de compromisos"
      >
        {FILTROS_AGENDA.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-bold",
              filtro === f
                ? "border-paramo-teal bg-paramo-teal-soft text-paramo-teal-ink"
                : "border-paramo-line bg-paramo-surface text-paramo-fg hover:bg-paramo-surface-2",
            )}
          >
            {etiquetaFiltro(f, userRol)}
            {counts[f] > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-extrabold",
                  f === "vencidos"
                    ? "bg-paramo-surface-2 text-paramo-bad"
                    : "bg-paramo-surface-2 text-paramo-muted",
                )}
              >
                {counts[f]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loadError ? (
        <section className="rounded-[12px] border border-paramo-line bg-paramo-surface px-4 py-8">
          <p className="text-sm text-paramo-bad" role="alert">
            No se pudo cargar los compromisos.
          </p>
        </section>
      ) : ordenados.length === 0 ? (
        <section className="rounded-[12px] border border-paramo-line bg-paramo-surface px-4 py-10 text-center">
          <h2 className="font-paramo-display text-lg font-bold text-paramo-fg">
            {vacio.title}
          </h2>
          <p className="mt-1 text-sm text-paramo-muted">{vacio.body}</p>
        </section>
      ) : (
        <div className="space-y-3">
          {filtro === "hechos" && coinciden.length > ordenados.length ? (
            <p className="px-1 text-xs text-paramo-muted">
              Mostrando 100 cumplidos.
            </p>
          ) : null}
          {grupos.map((g) => (
            <section
              key={g.label}
              className="overflow-hidden rounded-[12px] border border-paramo-line bg-paramo-surface"
            >
              <h2
                className={cn(
                  "border-b border-paramo-line px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em]",
                  g.late
                    ? "text-paramo-bad"
                    : "bg-paramo-surface-2 text-paramo-muted",
                )}
              >
                {g.label}
              </h2>
              <ul>
                {g.items.map((c) => (
                  <FilaCompromiso
                    key={c.id}
                    compromiso={c}
                    userId={userId}
                    userRol={userRol}
                    busy={busyId === c.id}
                    puedeAbrir={
                      !!c.prospecto_id && prospectById.has(c.prospecto_id)
                    }
                    onToggle={() => void onToggle(c)}
                    onEdit={() => {
                      setError(null);
                      setEditor({ mode: "edit", compromiso: c });
                    }}
                    onOpenProspecto={() => {
                      if (c.prospecto_id) setOpenId(c.prospecto_id);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editor ? (
        <CompromisoFormModal
          key={editor.mode === "edit" ? editor.compromiso.id : "new"}
          compromiso={editor.mode === "edit" ? editor.compromiso : null}
          responsables={responsables}
          prospectos={prospectos}
          userId={userId}
          userRol={userRol}
          onClose={() => setEditor(null)}
          onSubmit={(input) =>
            onSave(input, editor.mode === "edit" ? editor.compromiso.id : null)
          }
          onDelete={
            editor.mode === "edit"
              ? () => onDelete(editor.compromiso.id)
              : undefined
          }
        />
      ) : null}

      {lostProspecto ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-paramo-fg/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLostForId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Motivo de pérdida"
            className="w-full max-w-md rounded-[12px] border border-paramo-line bg-paramo-surface p-4"
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
                className={btnGhost}
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
          etapas={etapas}
          etapaIndex={etapaIndex}
          canMove={canEditProspecto(
            userRol,
            userId,
            openProspecto.responsable_id,
          )}
          moving={movingId === openProspecto.id}
          onClose={() => setOpenId(null)}
          onSetStage={(k) => void moveToStage(openProspecto.id, k)}
        />
      ) : null}
    </div>
  );
}

function TarjetaGrupo({
  grupo,
  selected,
  items,
  hoy,
  onClick,
}: {
  grupo: GrupoAgenda;
  selected: boolean;
  items: CompromisoAgendaItem[];
  hoy: string;
  onClick: () => void;
}) {
  const stats = statsDeGrupo(items, hoy);
  const letra = grupo === "supervisor" ? "S" : "C";
  const subtitulo = grupo === "supervisor" ? "Supervisión" : "Vendedores";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-[12px] border-2 bg-paramo-surface p-3 text-left hover:bg-paramo-surface-2",
        selected ? "border-paramo-brand" : "border-paramo-line",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white",
            grupo === "supervisor" ? "bg-paramo-brand" : "bg-paramo-teal",
          )}
          aria-hidden
        >
          {letra}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-bold text-paramo-fg">
            {etiquetaGrupo(grupo)}
          </span>
          <span className="block text-[11px] text-paramo-muted">{subtitulo}</span>
        </span>
      </span>
      <span className="mt-3 grid grid-cols-4 gap-1 text-center">
        <Stat n={String(stats.pendientes)} label="pendientes" />
        <Stat
          n={String(stats.vencidos)}
          label="vencidos"
          alert={stats.vencidos > 0}
        />
        <Stat n={stats.cumplido30} label="cumplido 30 d" />
        <Stat n={stats.aTiempo} label="a tiempo" />
      </span>
      <span className="mt-2 block line-clamp-2 text-xs text-paramo-muted">
        {stats.proximo ? (
          <>
            Próximo: <CompromisoFechaText fecha={stats.proximo.fecha} />
            {" · "}
            <span className="text-paramo-fg">{stats.proximo.titulo}</span>
          </>
        ) : (
          "Sin pendientes"
        )}
      </span>
    </button>
  );
}

function Stat({
  n,
  label,
  alert,
}: {
  n: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <span className="min-w-0">
      <span
        className={cn(
          "block text-xl font-bold leading-none text-paramo-fg",
          alert && "text-paramo-bad",
        )}
      >
        {n}
      </span>
      <span className="mt-1 block text-[10px] leading-tight text-paramo-muted">
        {label}
      </span>
    </span>
  );
}

function FilaCompromiso({
  compromiso: c,
  userId,
  userRol,
  busy,
  puedeAbrir,
  onToggle,
  onEdit,
  onOpenProspecto,
}: {
  compromiso: CompromisoAgendaItem;
  userId: string;
  userRol: Rol;
  busy: boolean;
  puedeAbrir: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onOpenProspecto: () => void;
}) {
  const access = accessDe(c);
  const puedeMarcar = canToggleCompromiso(userRol, userId, access);
  const puedeEditar = canEditCompromiso(userRol, userId, access);
  const mostrarQuien = userRol === "supervisor" || c.responsable_id !== userId;

  const tarde = Boolean(c.hecho && c.hecho_en && c.hecho_en > c.fecha);

  return (
    <li className="flex items-start justify-between gap-3 border-b border-paramo-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "font-semibold text-paramo-fg",
            c.hecho && "font-medium text-paramo-muted line-through",
          )}
        >
          {c.titulo}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-start gap-x-2 gap-y-1">
          <span className="rounded-full bg-paramo-surface-2 px-2 py-0.5 text-[11px] font-bold text-paramo-muted">
            {c.tipo}
          </span>
          {mostrarQuien ? (
            <WhoChip
              nombre={c.responsable_nombre}
              rol={c.responsable_rol ?? "comercial"}
              className="max-w-[11rem]"
            />
          ) : null}
          {c.asignado ? (
            <span className="rounded-full bg-paramo-brand-soft px-2 py-0.5 text-[11px] font-bold text-paramo-brand">
              Asignada por supervisor
            </span>
          ) : null}
          {c.prospecto_empresa ? (
            puedeAbrir ? (
              <button
                type="button"
                onClick={onOpenProspecto}
                className="inline-flex min-h-11 max-w-full items-center truncate font-semibold text-paramo-teal-ink underline-offset-2 hover:underline"
              >
                {c.prospecto_empresa}
              </button>
            ) : (
              <span className="truncate font-semibold text-paramo-fg">
                {c.prospecto_empresa}
              </span>
            )
          ) : null}
        </div>
        {c.notas ? (
          <p className="mt-1 line-clamp-2 text-left text-[12.5px] leading-snug text-paramo-muted">
            {c.notas}
          </p>
        ) : null}
        <p className="mt-1.5 text-left text-[13px] text-paramo-fg">
          <span className="font-bold">Fecha definida:</span>{" "}
          {fechaLarga(c.fecha)}
        </p>
        {c.hecho && c.hecho_en ? (
          <p className="mt-0.5 text-left text-[12.5px] text-paramo-muted">
            Cumplido: {fechaLarga(c.hecho_en)}
            {tarde ? (
              <span className="font-bold text-paramo-bad"> · tarde</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 pt-0.5">
        <button
          type="button"
          aria-pressed={c.hecho}
          disabled={!puedeMarcar || busy}
          onClick={onToggle}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-bold",
            c.hecho
              ? "border-paramo-teal bg-paramo-teal text-paramo-brand-ink"
              : "border-paramo-line bg-paramo-surface text-paramo-fg hover:bg-paramo-surface-2",
            (!puedeMarcar || busy) && "cursor-not-allowed opacity-50",
          )}
        >
          Hecho
        </button>
        {puedeEditar ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line bg-paramo-surface px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2"
          >
            Editar
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** Fecha de calendario en español, mes completo (sin «oct» ni «Hoy»). */
function fechaLarga(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    "es-CO",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

function CompromisoFormModal({
  compromiso,
  responsables,
  prospectos,
  userId,
  userRol,
  onClose,
  onSubmit,
  onDelete,
}: {
  compromiso: CompromisoAgendaItem | null;
  responsables: ResponsableOption[];
  prospectos: ProspectoListItem[];
  userId: string;
  userRol: Rol;
  onClose: () => void;
  onSubmit: (input: SaveBody) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const titleId = useId();
  const hoy = todayBogota();
  const editing = compromiso !== null;
  const [titulo, setTitulo] = useState(compromiso?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoCompromiso | string>(
    compromiso?.tipo ?? "Llamada",
  );
  const [fecha, setFecha] = useState(
    compromiso?.fecha ?? addDaysYmd(hoy, 1),
  );
  const [prospectoId, setProspectoId] = useState(
    compromiso?.prospecto_id ?? "",
  );
  const [notas, setNotas] = useState(compromiso?.notas ?? "");
  const [responsableId, setResponsableId] = useState(
    compromiso?.responsable_id ?? userId,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const opcionesResp = opcionesResponsable(responsables, compromiso);
  const opcionesPros = opcionesProspecto(prospectos, compromiso);
  const submitLabel = editing
    ? "Guardar"
    : responsableId === userId
      ? "Agendar"
      : "Asignar";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving || deleting) return;
      if (confirmDelete) setConfirmDelete(false);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete, deleting, onClose, saving]);

  useEffect(() => {
    document.getElementById("cf-titulo")?.focus();
  }, []);

  async function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || deleting) return;
    if (!titulo.trim() || !fecha) {
      setFormError("Completa el compromiso y la fecha límite.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit({
        titulo: titulo.trim(),
        tipo,
        fecha,
        prospecto_id: prospectoId || null,
        notas: notas.trim(),
        responsable_id: userRol === "supervisor" ? responsableId : userId,
      });
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "No se pudo guardar el compromiso.",
      );
      setSaving(false);
    }
  }

  async function confirmAndDelete() {
    if (!onDelete || deleting || saving) return;
    setFormError(null);
    setDeleting(true);
    try {
      await onDelete();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "No se pudo eliminar el compromiso.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-paramo-fg/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !deleting) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => void onFormSubmit(e)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[12px] border border-paramo-line bg-paramo-surface p-4"
        autoComplete="off"
      >
        <h2
          id={titleId}
          className="font-paramo-display text-xl font-bold text-paramo-fg"
        >
          {editing ? "Editar compromiso" : "Nuevo compromiso"}
        </h2>

        {userRol === "supervisor" ? (
          <div className="mt-4 space-y-1">
            <label htmlFor="cf-resp" className={labelClass}>
              ¿Quién lo hace?
            </label>
            <select
              id="cf-resp"
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className={fieldClass}
            >
              {opcionesResp.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                  {r.id === userId ? " (yo)" : ""} · {ROL_LABEL[r.rol]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-3 space-y-1">
          <label htmlFor="cf-titulo" className={labelClass}>
            ¿Qué hay que hacer? *
          </label>
          <input
            id="cf-titulo"
            required
            maxLength={240}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Llevar muestras de Piña Bites"
            className={fieldClass}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="cf-tipo" className={labelClass}>
              Tipo
            </label>
            <select
              id="cf-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={fieldClass}
            >
              {TIPOS_COMPROMISO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {TIPOS_COMPROMISO.includes(tipo as TipoCompromiso) ? null : (
                <option value={tipo}>{tipo}</option>
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-fecha" className={labelClass}>
              Fecha límite *
            </label>
            <input
              id="cf-fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ATAJOS_FECHA_COMPROMISO.map(([label, days]) => {
            const valor = addDaysYmd(hoy, days);
            const activo = fecha === valor;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={activo}
                onClick={() => setFecha(valor)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-bold",
                  activo
                    ? "border-paramo-teal bg-paramo-teal-soft text-paramo-teal-ink"
                    : "border-paramo-line text-paramo-fg hover:bg-paramo-surface-2",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-1">
          <label htmlFor="cf-prospecto" className={labelClass}>
            Prospecto / cliente
          </label>
          <select
            id="cf-prospecto"
            value={prospectoId}
            onChange={(e) => setProspectoId(e.target.value)}
            className={fieldClass}
          >
            <option value="">— Ninguno —</option>
            {opcionesPros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.empresa}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-1">
          <label htmlFor="cf-notas" className={labelClass}>
            Notas
          </label>
          <textarea
            id="cf-notas"
            rows={3}
            maxLength={4000}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={cn(fieldClass, "min-h-[88px] py-2")}
          />
        </div>

        {formError ? (
          <p className="mt-3 text-sm text-paramo-bad" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onDelete && confirmDelete ? (
            <p className="mr-auto text-sm text-paramo-fg">
              ¿Eliminar este compromiso?
            </p>
          ) : null}
          {onDelete && !confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="mr-auto inline-flex min-h-11 items-center text-sm font-bold text-paramo-bad hover:underline disabled:opacity-60"
            >
              Eliminar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) setConfirmDelete(false);
              else onClose();
            }}
            disabled={saving || deleting}
            className={btnGhost}
          >
            Cancelar
          </button>
          {confirmDelete && onDelete ? (
            <button
              type="button"
              onClick={() => void confirmAndDelete()}
              disabled={deleting}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-bad px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "…" : "Eliminar"}
            </button>
          ) : (
            <button type="submit" disabled={saving || deleting} className={btnPri}>
              {saving ? "…" : submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function opcionesProspecto(
  prospectos: ProspectoListItem[],
  editing: CompromisoAgendaItem | null,
): { id: string; empresa: string }[] {
  const list = prospectos
    .filter((p) => p.activo)
    .map((p) => ({ id: p.id, empresa: p.empresa }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "es"));
  if (
    editing?.prospecto_id &&
    !list.some((p) => p.id === editing.prospecto_id)
  ) {
    list.push({
      id: editing.prospecto_id,
      empresa: editing.prospecto_empresa || "Prospecto vinculado",
    });
  }
  return list;
}

function opcionesResponsable(
  responsables: ResponsableOption[],
  editing: CompromisoAgendaItem | null,
): ResponsableOption[] {
  if (
    !editing?.responsable_id ||
    !editing.responsable_rol ||
    responsables.some((r) => r.id === editing.responsable_id)
  ) {
    return responsables;
  }
  return [
    ...responsables,
    {
      id: editing.responsable_id,
      nombre: editing.responsable_nombre,
      rol: editing.responsable_rol,
    },
  ];
}
