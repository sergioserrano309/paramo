import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { cargarSeguimientoProducto } from "@/lib/productos-seguimiento";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo cargar el seguimiento del producto.";

type RouteParams = { params: Promise<{ id: string }> };

/** Prospectos interesados y retroalimentación de un producto. */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("productos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`productos-seguimiento:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const data = await cargarSeguimientoProducto(createServiceClient(), id);
  if (!data) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json(data);
}
