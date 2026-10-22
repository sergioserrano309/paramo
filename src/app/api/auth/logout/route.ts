import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase-auth";
import { hasSupabaseAuthConfig } from "@/lib/env";

export async function POST() {
  if (!hasSupabaseAuthConfig()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const auth = await createAuthClient();
    await auth.auth.signOut();
  } catch {
    // Idempotente: si no hay config/sesión, igual respondemos ok.
  }

  return NextResponse.json({ ok: true });
}
