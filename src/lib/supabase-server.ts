import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv, hasSupabaseServiceConfig } from "@/lib/env";

/**
 * Cliente Supabase con service_role — SOLO para API routes / Server Components
 * que ya autorizaron sesión + rol. Bypasea RLS; la autorización vive en la API.
 *
 * Nunca importar este módulo desde un componente con 'use client'.
 */
export function createServiceClient(): SupabaseClient {
  if (!hasSupabaseServiceConfig()) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Revisa .env.local.",
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
