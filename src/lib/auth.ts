import { cache } from "react";
import { redirect } from "next/navigation";
import { isRol } from "@/config/roles";
import { createAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { hasSupabaseAuthConfig, hasSupabaseServiceConfig } from "@/lib/env";
import type { Profile } from "@/lib/types/profile";

export type AuthContext = {
  userId: string;
  email: string;
  profile: Profile;
};

type ProfileRow = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
};

function toProfile(row: ProfileRow): Profile | null {
  if (!isRol(row.rol)) return null;
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    activo: row.activo,
  };
}

/**
 * Sesión Auth + perfil de negocio reconsultado (no confiar solo en JWT).
 * Devuelve null si no hay sesión, perfil inexistente o usuario inactivo.
 *
 * `cache` de React la memoriza durante un mismo render: el layout y la página la llaman
 * cada uno y antes pagaban dos veces el viaje a Supabase Auth y la consulta de `profiles`
 * en cada navegación. La autorización sigue verificándose en cada request.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  if (!hasSupabaseAuthConfig() || !hasSupabaseServiceConfig()) {
    return null;
  }

  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) return null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("id, email, nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const profile = toProfile(data as ProfileRow);
  if (!profile || !profile.activo) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
  };
});

/** Para layouts del CRM: sin contexto válido → /login. */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}
