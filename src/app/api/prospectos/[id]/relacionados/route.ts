import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { cargarFicha } from "@/lib/ficha-prospecto";
import { clientKey } from "@/lib/http";
import { cargarFeedbackProspecto } from "@/lib/productos-seguimiento";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo cargar lo relacionado del prospecto.";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Cotizaciones del prospecto, productos de interés (con cuáles tiene marcados) y su
 * retroalimentación. El panel
 * de detalle los pide aparte del resto de la ficha, que ya carga por sus propias rutas.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`prospectos-relacionados:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const [ficha, feedback] = await Promise.all([
    cargarFicha(service, id, auth.profile.rol, auth.userId),
    cargarFeedbackProspecto(service, id),
  ]);
  if (!ficha) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  return NextResponse.json({
    cotizaciones: ficha.cotizaciones,
    productos: ficha.productos,
    feedback: feedback ?? [],
  });
}
