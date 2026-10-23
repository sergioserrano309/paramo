import { NextResponse } from "next/server";
import { z } from "zod";
import { isRol } from "@/config/roles";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { cargarBitacora } from "@/lib/bitacora-consulta";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo cargar la bitácora.";

const querySchema = z.object({
  rol: z.string().optional(),
  accion: z.string().trim().max(120).optional(),
  q: z.string().trim().max(80).optional(),
});

/** Bitácora con filtros (as-is: usuario, acción y texto). Solo `auditar` (supervisor). */
export async function GET(request: Request) {
  const auth = await requireApiPermission("auditar");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (!rateLimit(`bitacora:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    rol: sp.get("rol") || undefined,
    accion: sp.get("accion") || undefined,
    q: sp.get("q") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  const { rol, accion, q } = parsed.data;
  if (rol && !isRol(rol)) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const eventos = await cargarBitacora(createServiceClient(), {
    rol: rol && isRol(rol) ? rol : undefined,
    accion,
    q,
  });
  if (!eventos) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ eventos });
}
