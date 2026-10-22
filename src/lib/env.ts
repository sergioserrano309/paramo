/**
 * Lectura de variables de entorno.
 * Fallar cerrado en Auth y datos: hasSupabaseAuthConfig / hasSupabaseServiceConfig.
 */

export function getPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };
}

export function getServerEnv() {
  return {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

export function hasSupabaseAuthConfig() {
  const pub = getPublicEnv();
  return (
    pub.NEXT_PUBLIC_SUPABASE_URL.startsWith("http") &&
    pub.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  );
}

/** True cuando hay URL + service role para operaciones de datos en API. */
export function hasSupabaseServiceConfig() {
  const pub = getPublicEnv();
  const srv = getServerEnv();
  return (
    pub.NEXT_PUBLIC_SUPABASE_URL.startsWith("http") &&
    srv.SUPABASE_SERVICE_ROLE_KEY.length > 0
  );
}
