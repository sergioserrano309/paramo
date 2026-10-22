import Link from "next/link";
import { AppNav } from "@/components/AppNav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-paramo-bg text-paramo-fg md:grid md:grid-cols-[224px_1fr]">
      <aside className="sticky top-0 flex h-auto flex-col gap-1 border-b border-paramo-line bg-paramo-surface p-3 md:h-screen md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 px-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-paramo-teal-ink">
            Good Chips
          </p>
          <p className="font-paramo-display text-[23px] font-bold leading-tight text-paramo-brand">
            Páramo
          </p>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-paramo-leaf">
            CRM comercial
          </p>
        </div>
        <AppNav />
        <div className="mt-auto hidden pt-4 text-xs text-paramo-muted md:block">
          <Link href="/login" className="font-bold text-paramo-teal-ink hover:underline">
            Ir a ingreso
          </Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-7 md:py-6">{children}</main>
    </div>
  );
}
