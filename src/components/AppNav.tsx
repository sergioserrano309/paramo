"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/config/navigation";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
      aria-label="Módulos"
    >
      {APP_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-lg bg-paramo-brand-soft px-2.5 py-2 text-sm font-extrabold text-paramo-brand"
                : "rounded-lg px-2.5 py-2 text-sm font-semibold text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
