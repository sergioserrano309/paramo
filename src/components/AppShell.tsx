import { AppNav } from "@/components/AppNav";
import { AtajosTeclado } from "@/components/AtajosTeclado";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { navForRol } from "@/config/navigation";
import type { Modulo } from "@/config/permissions";
import { ROL_LABEL } from "@/config/roles";
import type { Insignia } from "@/lib/insignias";
import type { Profile } from "@/lib/types/profile";

type AppShellProps = {
  children: React.ReactNode;
  profile: Profile;
  insignias: Partial<Record<Modulo, Insignia>>;
  puedeCrear: boolean;
};

export function AppShell({ children, profile, insignias, puedeCrear }: AppShellProps) {
  const navItems = navForRol(profile.rol);

  return (
    <div className="min-h-screen bg-paramo-bg text-paramo-fg md:grid md:grid-cols-[224px_1fr]">
      <AtajosTeclado puedeCrearProspecto={puedeCrear} puedeCrearCompromiso={puedeCrear} />
      <aside className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-paramo-line bg-paramo-surface p-3 md:h-screen md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-b-0 md:border-r md:p-4">
        <div className="px-2 md:mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-paramo-teal-ink">
            Good Chips
          </p>
          <p className="font-paramo-display text-[23px] font-bold leading-tight text-paramo-brand">
            Páramo
          </p>
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-paramo-leaf md:block">
            CRM comercial
          </p>
        </div>
        <AppNav items={navItems} insignias={insignias} />
        <div className="space-y-2 md:mt-auto md:pt-4">
          <div className="hidden rounded-[10px] border border-paramo-line bg-paramo-surface-2 p-2.5 md:block">
            <p className="truncate text-sm font-bold text-paramo-fg">
              {profile.nombre || profile.email}
            </p>
            <p className="text-xs text-paramo-muted">{ROL_LABEL[profile.rol]}</p>
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {puedeCrear ? (
            <p className="hidden text-[11px] text-paramo-muted md:block">
              <kbd className="rounded border border-paramo-line px-1">N</kbd> nuevo prospecto ·{" "}
              <kbd className="rounded border border-paramo-line px-1">C</kbd> compromiso
            </p>
          ) : null}
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-5 pb-24 md:px-7 md:py-6 md:pb-6">{children}</main>
    </div>
  );
}
