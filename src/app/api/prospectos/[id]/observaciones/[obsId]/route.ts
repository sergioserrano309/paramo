import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { can, isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 8_192;
const DENIED = "No se pudo guardar la observación.";

const replySchema = z.object({
  respuesta: z.string().trim().max(2000),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

type RouteParams = { params: Promise<{ id: string; obsId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!can(auth.profile.rol, "editar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id, obsId } = await params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(obsId).success
  ) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`obs-reply:${auth.userId}:${clientKey(request)}`, 40, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: DENIED }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const parsed = replySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const { data: actual, error: loadError } = await service
    .from("observaciones")
    .select("id, estado, prospecto_id")
    .eq("id", obsId)
    .eq("prospecto_id", id)
    .maybeSingle();

  if (loadError || !actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (actual.estado !== "abierta") {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const { error } = await service
    .from("observaciones")
    .update({
      estado: "atendida",
      respuesta: parsed.data.respuesta,
      atendida_por: auth.userId,
      atendida_en: new Date().toISOString(),
    })
    .eq("id", obsId);

  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!can(auth.profile.rol, "observar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id, obsId } = await params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(obsId).success
  ) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`obs-del:${auth.userId}:${clientKey(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const { data: actual, error: loadError } = await service
    .from("observaciones")
    .select("id, estado, autor_id, prospecto_id")
    .eq("id", obsId)
    .eq("prospecto_id", id)
    .maybeSingle();

  if (loadError || !actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (actual.estado !== "abierta" || actual.autor_id !== auth.userId) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = await service.from("observaciones").delete().eq("id", obsId);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
