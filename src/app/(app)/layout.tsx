import { AppShell } from "@/components/AppShell";
import { requireAuthContext } from "@/lib/auth";

/** Auth depende de cookies/sesión: no prerenderizar el shell como estático. */
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuthContext();

  return <AppShell profile={profile}>{children}</AppShell>;
}
