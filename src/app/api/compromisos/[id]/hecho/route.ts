import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { cargarCompromiso } from "@/lib/compromisos";
import { puedeMarcarCompromiso } from "@/lib/compromisos-permisos";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { registrarActividad } from "@/lib/actividad";
import { registrarBitacora } from "@/lib/bitacora";
import { daysBetween, todayBogota } from "@/lib/format";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo actualizar el compromiso.";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Marca un compromiso como hecho / pendiente (as-is toggleC). Al marcarlo hecho, el
 * prospecto vinculado anota «Cumplido: …» en su historial y registra hoy como último
 * contacto (alimenta la alerta «stale»). Queda en bitácora, con los días de retraso.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`compromisos-hecho:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 256);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = z.object({ hecho: z.boolean() }).safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const actual = await cargarCompromiso(service, id);
  if (!actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (!puedeMarcarCompromiso(auth.profile.rol, auth.userId, actual)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const hoy = todayBogota();
  const { hecho } = parsed.data;
  const { error } = await service
    .from("compromisos")
    .update({
      hecho,
      hecho_en: hecho ? hoy : null,
      actualizado_por: auth.userId,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  // Al cumplirlo, el historial del prospecto lo registra y hoy queda como último contacto.
  if (hecho && actual.prospecto_id) {
    await registrarActividad(service, {
      prospectoId: actual.prospecto_id,
      tipo: actual.tipo,
      texto: `Cumplido: ${actual.titulo}`,
      usuarioId: auth.userId,
      tocarContacto: true,
    });
  }

  const retraso = hecho && hoy > actual.fecha ? daysBetween(actual.fecha, hoy) : 0;
  await registrarBitacora(
    service,
    auth,
    hecho ? "Compromiso cumplido" : "Compromiso reabierto",
    `${actual.prospecto_empresa ? actual.prospecto_empresa + ": " : ""}${actual.titulo} · responsable ${actual.responsable_nombre}${retraso ? ` (con ${retraso} d de retraso)` : ""}`,
    actual.prospecto_id ? { tabla: "prospectos", id: actual.prospecto_id } : undefined,
  );

  const compromiso = await cargarCompromiso(service, id);
  if (!compromiso) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, compromiso });
}
