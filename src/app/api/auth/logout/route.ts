import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";
import { createAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { hasSupabaseAuthConfig } from "@/lib/env";

export async function POST() {
  if (!hasSupabaseAuthConfig()) {
    return NextResponse.json({ ok: true });
  }

  try {
    // As-is: la salida queda en bitácora («Salida»). Se lee la sesión antes de cerrarla.
    const ctx = await getAuthContext();
    if (ctx) {
      await registrarBitacora(createServiceClient(), ctx, "Salida", "Cerró sesión");
    }
    const auth = await createAuthClient();
    await auth.auth.signOut();
  } catch {
    // Idempotente: si no hay config/sesión, igual respondemos ok.
  }

  return NextResponse.json({ ok: true });
}
