"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { NavItem } from "@/config/navigation";
import type { Modulo } from "@/config/permissions";
import { cn } from "@/lib/cn";
import type { Insignia } from "@/lib/insignias";

type AppNavProps = {
  items: NavItem[];
  insignias: Partial<Record<Modulo, Insignia>>;
};

const TONO_INSIGNIA: Record<Insignia["tono"], string> = {
  alerta: "bg-paramo-bad text-paramo-brand-ink",
  marca: "bg-paramo-brand text-paramo-brand-ink",
  suave: "bg-paramo-surface-2 text-paramo-muted",
};

function Contador({ i }: { i: Insignia | undefined }) {
  if (!i) return null;
  return (
    <span
      className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${TONO_INSIGNIA[i.tono]}`}
      aria-label={`${i.n} pendientes`}
    >
      {i.n}
    </span>
  );
}

/**
 * Menú de módulos: rail con icono en escritorio y barra inferior en móvil.
 * Los contadores vienen del servidor (compromisos vencidos, aprobaciones, observaciones).
 */
export function AppNav({ items, insignias }: AppNavProps) {
  const pathname = usePathname();
  const activo = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <>
      <nav className="hidden flex-col gap-1 md:flex" aria-label="Módulos">
        {items.map((item) => {
          const active = activo(item);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm md:w-full",
                active
                  ? "bg-paramo-brand-soft font-extrabold text-paramo-brand"
                  : "font-semibold text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg",
              )}
            >
              <NavIcon name={item.key} />
              <span>{item.label}</span>
              <Contador i={insignias[item.key]} />
            </Link>
          );
        })}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-paramo-line bg-paramo-surface p-1.5 md:hidden"
        aria-label="Módulos"
      >
        {items.map((item) => {
          const active = activo(item);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-12 min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[11px]",
                active
                  ? "bg-paramo-brand-soft font-extrabold text-paramo-brand"
                  : "font-semibold text-paramo-muted",
              )}
            >
              <NavIcon name={item.key} />
              <span>{item.corto ?? item.label}</span>
              {insignias[item.key] ? (
                <span
                  className={`absolute right-1 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold ${
                    TONO_INSIGNIA[insignias[item.key]?.tono ?? "suave"]
                  }`}
                >
                  {insignias[item.key]?.n}
                </span>
              ) : null}
            </Link>
          );
        })}
        <ThemeToggle className="flex min-h-12 min-w-[72px] flex-1 items-center justify-center rounded-lg px-2 text-[11px] font-semibold text-paramo-muted" />
      </nav>
    </>
  );
}
