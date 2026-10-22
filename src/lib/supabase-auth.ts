import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv, hasSupabaseAuthConfig } from "@/lib/env";

/**
 * Cliente Supabase con la sesión del usuario (cookies).
 * Solo para Auth (login/logout/getUser). Datos de negocio: service_role vía API.
 */
export async function createAuthClient() {
  if (!hasSupabaseAuthConfig()) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa .env.local.",
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // set desde Server Component de solo lectura: el middleware ya refresca la sesión.
        }
      },
    },
  });
}
