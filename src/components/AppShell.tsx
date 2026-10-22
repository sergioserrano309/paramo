import { AppNav } from "@/components/AppNav";
import { LogoutButton } from "@/components/LogoutButton";
import { ROL_LABEL } from "@/config/roles";
import type { Profile } from "@/lib/types/profile";

type AppShellProps = {
  children: React.ReactNode;
  profile: Profile;
};

export function AppShell({ children, profile }: AppShellProps) {
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
        <div className="mt-auto space-y-2 pt-4">
          <div className="rounded-[10px] border border-paramo-line bg-paramo-surface-2 p-2.5">
            <p className="truncate text-sm font-bold text-paramo-fg">
              {profile.nombre || profile.email}
            </p>
            <p className="text-xs text-paramo-muted">{ROL_LABEL[profile.rol]}</p>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-7 md:py-6">{children}</main>
    </div>
  );
}
