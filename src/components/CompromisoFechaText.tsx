import { cn } from "@/lib/cn";
import {
  compromisoFechaTone,
  formatCompromisoFecha,
  todayBogota,
} from "@/lib/format";

type CompromisoFechaTextProps = {
  fecha: string;
  className?: string;
};

/** Fecha de compromiso con tono vencido / hoy (as-is dateClass + dateTxt). */
export function CompromisoFechaText({
  fecha,
  className,
}: CompromisoFechaTextProps) {
  const hoy = todayBogota();
  const tone = compromisoFechaTone(fecha, hoy);
  return (
    <span
      className={cn(
        tone === "late" && "font-bold text-paramo-bad",
        tone === "today" && "font-bold text-paramo-teal-ink",
        tone === "ok" && "text-paramo-fg",
        className,
      )}
    >
      {formatCompromisoFecha(fecha, hoy)}
    </span>
  );
}
