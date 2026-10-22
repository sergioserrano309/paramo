import { NextResponse } from "next/server";
import { hasSupabaseServiceConfig } from "@/lib/env";

/**
 * Healthcheck del setup: no expone secretos ni datos de negocio.
 * Útil para verificar que la API responde tras clonar el repo.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    servicio: "paramo-crm",
    supabaseConfigurado: hasSupabaseServiceConfig(),
  });
}
