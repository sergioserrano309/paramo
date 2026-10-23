"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

type AppNavProps = {
  items: NavItem[];
};

export function AppNav({ items }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
      aria-label="Módulos"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          </Link>
        );
      })}
    </nav>
  );
}
