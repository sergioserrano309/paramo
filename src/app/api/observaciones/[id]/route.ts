import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { can } from "@/lib/can";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { cargarObservacion } from "@/lib/observaciones";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo actualizar la observación.";

type RouteParams = { params: Promise<{ id: string }> };

const atenderSchema = z.object({
  respuesta: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(2_000)),
});

/** Marca la observación como atendida con una respuesta opcional. Solo `editar`. */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("dashboard");
  if (!isAuthContext(auth)) return auth;

  if (!can(auth.profile.rol, "editar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`observaciones-atender:${auth.userId}:${clientKey(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = atenderSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const actual = await cargarObservacion(service, id);
  if (!actual || actual.estado !== "abierta") {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const { respuesta } = parsed.data;
  const { error } = await service
    .from("observaciones")
    .update({
      estado: "atendida",
      respuesta,
      atendida_en: new Date().toISOString(),
      atendida_por: auth.userId,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Observación atendida",
    `${respuesta || "Sin comentario"} · ${actual.texto.slice(0, 80)}`,
    actual.prospecto_id ? { tabla: "prospectos", id: actual.prospecto_id } : undefined,
  );

  const observacion = await cargarObservacion(service, id);
  if (!observacion) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, observacion });
}

/** Retira una observación propia que sigue abierta (as-is delObs: `observar` y autor). */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("dashboard");
  if (!isAuthContext(auth)) return auth;

  if (!can(auth.profile.rol, "observar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`observaciones-retirar:${auth.userId}:${clientKey(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const actual = await cargarObservacion(service, id);
  if (!actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (actual.autor_id !== auth.userId || actual.estado !== "abierta") {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = await service.from("observaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Observación retirada",
    actual.texto.slice(0, 160),
    actual.prospecto_id ? { tabla: "prospectos", id: actual.prospecto_id } : undefined,
  );
  return NextResponse.json({ ok: true });
}
