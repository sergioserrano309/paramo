"use client";

import { useEffect } from "react";
import { CALIF_TXT, stars3 } from "@/config/calificacion";
import { cn } from "@/lib/cn";
import { formatDateShort, formatMoneyShort } from "@/lib/format";
import type { EtapaCatalogo, ProspectoListItem } from "@/lib/types/prospecto";

const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const secClass =
  "text-[11px] font-extrabold uppercase tracking-[0.09em] text-paramo-muted";

type ProspectoDetalleDrawerProps = {
  titleId: string;
  prospecto: ProspectoListItem;
  etapas: EtapaCatalogo[];
  etapaIndex: Map<string, number>;
  canMove: boolean;
  moving: boolean;
  onClose: () => void;
  onSetStage: (codigo: string) => void;
};

/**
 * Drawer de ficha (as-is openP / Abrir en funnel).
 * Este hito: ver datos + cambiar etapa; resto «Próximamente».
 */
export function ProspectoDetalleDrawer({
  titleId,
  prospecto: p,
  etapas,
  etapaIndex,
  canMove,
  moving,
  onClose,
  onSetStage,
}: ProspectoDetalleDrawerProps) {
  const ci = etapaIndex.get(p.etapa_codigo) ?? 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        className="flex h-full w-full max-w-lg flex-col border-l border-paramo-line bg-paramo-bg shadow-lg"
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
              Creado {formatDateShort(p.creado_en)}
              {p.etapa_desde
                ? ` · en esta etapa desde ${formatDateShort(p.etapa_desde)}`
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
          <div className="flex flex-wrap gap-4">
            <div>
              <div className={secClass}>Calificación</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg text-paramo-olive" aria-hidden>
                  {stars3(p.calificacion)}
                </span>
                <span className="text-xs text-paramo-muted">
                  {CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-paramo-muted">
                Edición de calificación: próximamente
              </p>
            </div>
            <div className="min-w-[180px] flex-1">
              <div className={secClass}>Responsable</div>
              <p className="mt-1 text-sm font-semibold text-paramo-fg">
                {p.responsable_nombre}
              </p>
              <p className="mt-1 text-[11px] text-paramo-muted">
                Reasignar: próximamente
              </p>
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
                const enabled = canMove && !moving;
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
            <p className="mt-2 text-[11px] text-paramo-muted">
              Inactivar / reactivar: próximamente
            </p>
          </div>

          <ProxSection title="Observaciones del supervisor" />
          <ProxSection title="Registrar actividad" />
          <ProxSection title="Cotizaciones" />
          <ProxSection title="Compromisos" />
          <ProxSection title="Productos de interés" />

          <fieldset disabled className="grid gap-3 sm:grid-cols-2">
            <legend className={cn(secClass, "mb-1 w-full")}>Datos</legend>
            <ReadField label="Empresa" value={p.empresa} full />
            <ReadField label="NIT" value={p.nit || "—"} />
            <ReadField label="Contacto" value={p.contacto || "—"} />
            <ReadField label="Cargo" value={p.cargo || "—"} />
            <ReadField label="Teléfono" value={p.telefono || "—"} />
            <ReadField label="Correo" value={p.email || "—"} />
            <ReadField label="Ciudad" value={p.ciudad || "—"} />
            <ReadField label="Canal" value={p.canal_nombre || "—"} />
            <ReadField
              label="Tipo de cliente"
              value={p.tipo_cliente_nombre || "—"}
            />
            <ReadField label="Fuente" value={p.fuente_nombre || "—"} />
            <ReadField
              label="Venta mensual estimada"
              value={
                p.valor_mensual_estimado
                  ? formatMoneyShort(p.valor_mensual_estimado)
                  : "—"
              }
            />
            <ReadField label="Etapa" value={p.etapa_nombre} />
            <ReadField
              label="Calificación"
              value={CALIF_TXT[p.calificacion] ?? CALIF_TXT[0]}
            />
            <ReadField label="Responsable" value={p.responsable_nombre} full />
            <ReadField label="Notas" value={p.notas || "—"} full multiline />
          </fieldset>

          <ProxSection title="Historial" />
        </div>
      </div>
    </div>
  );
}

function ProxSection({ title }: { title: string }) {
  return (
    <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-3 opacity-70">
      <div className="flex items-center justify-between gap-2">
        <span className={secClass}>{title}</span>
        <span className="rounded-full bg-paramo-surface-2 px-2 py-0.5 text-[11px] font-bold text-paramo-muted">
          Próximamente
        </span>
      </div>
      <p className="mt-2 text-xs text-paramo-muted">
        Disponible cuando el módulo correspondiente esté operativo.
      </p>
      <button
        type="button"
        disabled
        className="mt-2 inline-flex min-h-9 cursor-not-allowed items-center rounded-lg border border-paramo-line px-3 text-xs font-bold text-paramo-muted opacity-60"
      >
        Acción deshabilitada
      </button>
    </div>
  );
}

function ReadField({
  label,
  value,
  full,
  multiline,
}: {
  label: string;
  value: string;
  full?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={cn("space-y-1", full && "sm:col-span-2")}>
      <span className={labelClass}>{label}</span>
      {multiline ? (
        <p className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-paramo-line bg-paramo-surface px-3 py-2 text-sm text-paramo-fg">
          {value}
        </p>
      ) : (
        <p className="flex min-h-11 items-center rounded-lg border border-paramo-line bg-paramo-surface px-3 text-sm text-paramo-fg">
          {value}
        </p>
      )}
    </div>
  );
}
