import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { cargarObservacion, cargarObservaciones } from "@/lib/observaciones";
import {
  isAuthContext,
  requireApiModuleAccess,
  requireApiPermission,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 4_096;
const LIST_DENIED = "No se pudo cargar las observaciones.";
const CREATE_DENIED = "No se pudo enviar la observación.";

const bodySchema = z.object({
  prospecto_id: z.string().uuid().nullable().optional(),
  texto: z.string().trim().min(1).max(2_000),
});

/** Las ven ambos roles (as-is: Supervisión, y el Dashboard del comercial). */
export async function GET() {
  const auth = await requireApiModuleAccess("dashboard");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const observaciones = await cargarObservaciones(createServiceClient());
  if (!observaciones) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }
  return NextResponse.json({ observaciones });
}

/** Crear observaciones es `observar` (supervisor). */
export async function POST(request: Request) {
  const auth = await requireApiPermission("observar");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`observaciones-create:${auth.userId}:${clientKey(request)}`, 30, 60_000)
  ) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  const { texto, prospecto_id } = parsed.data;

  const service = createServiceClient();
  let empresa = "";
  if (prospecto_id) {
    const { data: p } = await service
      .from("prospectos")
      .select("empresa")
      .eq("id", prospecto_id)
      .maybeSingle();
    if (!p) {
      return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
    }
    empresa = p.empresa as string;
  }

  const { data: creada, error } = await service
    .from("observaciones")
    .insert({ prospecto_id: prospecto_id ?? null, texto, autor_id: auth.userId })
    .select("id")
    .single();
  if (error || !creada) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Observación",
    `${empresa ? empresa + ": " : ""}${texto.slice(0, 160)}`,
    prospecto_id ? { tabla: "prospectos", id: prospecto_id } : undefined,
  );

  const observacion = await cargarObservacion(service, creada.id as string);
  if (!observacion) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, observacion }, { status: 201 });
}
