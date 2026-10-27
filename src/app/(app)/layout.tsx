import { AppShell } from "@/components/AppShell";
import { requireAuthContext } from "@/lib/auth";
import { can } from "@/lib/can";
import { cargarInsignias } from "@/lib/insignias";

/** Auth depende de cookies/sesión: no prerenderizar el shell como estático. */
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuthContext();
  const insignias = await cargarInsignias(profile.rol);

  return (
    <AppShell
      profile={profile}
      insignias={insignias}
      // As-is canCreateP: crear exige `editar` o `asignar` (también para los atajos N y C).
      puedeCrear={can(profile.rol, "editar") || can(profile.rol, "asignar")}
    >
      {children}
    </AppShell>
  );
}
