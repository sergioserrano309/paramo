import { NextResponse } from "next/server";
import { z } from "zod";
import { ACT_TIPOS } from "@/config/prospectos";
import { registrarActividad } from "@/lib/actividad";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { canEditProspecto } from "@/lib/can";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { cargarFicha } from "@/lib/ficha-prospecto";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo registrar la actividad.";

const bodySchema = z.object({
  tipo: z.enum(ACT_TIPOS),
  texto: z.string().trim().min(1).max(500),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Registra un contacto con el prospecto (as-is actForm) y marca hoy como último contacto. */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`prospectos-actividad:${auth.userId}:${clientKey(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 2_048);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const { data: actual } = await service
    .from("prospectos")
    .select("id, empresa, activo, responsable_id")
    .eq("id", id)
    .maybeSingle();
  if (!actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (!canEditProspecto(auth.profile.rol, auth.userId, actual.responsable_id as string)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  // As-is: la actividad se registra solo mientras el prospecto está activo.
  if (actual.activo === false) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const { tipo, texto } = parsed.data;
  await registrarActividad(service, {
    prospectoId: id,
    tipo,
    texto,
    usuarioId: auth.userId,
    tocarContacto: true,
  });
  await registrarBitacora(
    service,
    auth,
    "Actividad registrada",
    `${actual.empresa} · ${tipo}: ${texto}`,
    { tabla: "prospectos", id },
  );

  const ficha = await cargarFicha(service, id, auth.profile.rol);
  if (!ficha) return NextResponse.json({ error: DENIED }, { status: 500 });
  return NextResponse.json({ ok: true, ficha });
}
