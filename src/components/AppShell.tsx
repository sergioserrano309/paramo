import { AppNav } from "@/components/AppNav";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { navForRol } from "@/config/navigation";
import { ROL_LABEL } from "@/config/roles";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types/profile";

type AppShellProps = {
  children: React.ReactNode;
  profile: Profile;
};

export function AppShell({ children, profile }: AppShellProps) {
  const navItems = navForRol(profile.rol);

  return (
    <div className="min-h-screen bg-paramo-bg text-paramo-fg md:grid md:grid-cols-[224px_1fr]">
      <aside className="sticky top-0 flex h-auto flex-col gap-1 border-b border-paramo-line bg-paramo-surface p-3 md:h-screen md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 px-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-paramo-teal-ink">
            Good Chips
          </p>
          <p className="font-paramo-display text-[23px] font-bold leading-[1.1] text-paramo-brand">
            Páramo
            <br />
            Snacks
          </p>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-paramo-leaf">
            CRM comercial
          </p>
        </div>
        <AppNav items={navItems} />
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <div className="flex items-center gap-2 rounded-[10px] border border-paramo-line bg-paramo-surface-2 p-2.5">
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white",
                profile.rol === "supervisor"
                  ? "bg-paramo-brand text-paramo-brand-ink"
                  : "bg-paramo-teal",
              )}
              aria-hidden
            >
              {initials(profile.nombre || profile.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-paramo-fg">
                {profile.nombre || profile.email}
              </p>
              <p className="text-xs text-paramo-muted">
                {ROL_LABEL[profile.rol]}
              </p>
            </div>
            <LogoutButton />
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-7 md:py-6">{children}</main>
    </div>
  );
}
