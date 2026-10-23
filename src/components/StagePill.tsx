import { ETAPA_COL_COLOR } from "@/config/funnel";

type StagePillProps = {
  codigo: string;
  nombre: string;
};

/** Pill de etapa con punto de color (as-is stagePill). */
export function StagePill({ codigo, nombre }: StagePillProps) {
  const color = ETAPA_COL_COLOR[codigo] ?? "var(--paramo-muted)";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-paramo-surface-2 px-2.5 py-0.5 text-[11.5px] font-bold text-paramo-fg">
      <i
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {nombre}
    </span>
  );
}
