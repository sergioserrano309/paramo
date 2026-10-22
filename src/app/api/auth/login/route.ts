import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_DENIED_MESSAGE } from "@/lib/auth-errors";
import { rateLimit } from "@/lib/rate-limit";
import { createAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { hasSupabaseAuthConfig, hasSupabaseServiceConfig } from "@/lib/env";
import { isRol } from "@/config/roles";

const MAX_BODY_BYTES = 4_096;

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseAuthConfig() || !hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 503 });
  }

  if (!rateLimit(`login:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 422 });
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 422 });
  }

  const auth = await createAuthClient();
  const { data, error } = await auth.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 401 });
  }

  // Reconsultar profiles: sesión Auth no autoriza sola.
  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, email, nombre, rol, activo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.activo ||
    !isRol(profile.rol as string)
  ) {
    await auth.auth.signOut();
    return NextResponse.json({ error: AUTH_DENIED_MESSAGE }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: profile.id,
      email: profile.email,
      nombre: profile.nombre,
      rol: profile.rol,
    },
  });
}
