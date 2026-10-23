import { ROL_LABEL, type Rol } from "@/config/roles";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

type WhoChipProps = {
  nombre: string;
  rol: Rol;
  /** Muestra el rol debajo del nombre (listado Prospectos). */
  showRol?: boolean;
  size?: "xs" | "sm";
  className?: string;
};

/** Avatar por iniciales + nombre; color según rol (as-is who-chip). */
export function WhoChip({
  nombre,
  rol,
  showRol = false,
  size = "xs",
  className,
}: WhoChipProps) {
  const avatarSize =
    size === "xs" ? "h-[22px] w-[22px] text-[9.5px]" : "h-8 w-8 text-[13px]";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white",
          avatarSize,
          rol === "supervisor" ? "bg-paramo-brand" : "bg-paramo-teal",
        )}
        aria-hidden
      >
        {initials(nombre)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12.5px] text-paramo-fg">
          {nombre}
        </span>
        {showRol ? (
          <span className="block truncate text-[11px] text-paramo-muted">
            {ROL_LABEL[rol]}
          </span>
        ) : null}
      </span>
    </span>
  );
}
