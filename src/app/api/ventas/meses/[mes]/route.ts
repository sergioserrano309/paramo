import { NextResponse } from "next/server";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { mesLargo } from "@/lib/ventas-periodo";

const DENIED = "No se pudo eliminar el mes.";

type RouteParams = { params: Promise<{ mes: string }> };

/** Elimina todas las ventas de un mes (as-is deleteMonth). Solo `editar`. */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiPermission("editar");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { mes } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`ventas-mes:${auth.userId}:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const { error } = await service.from("ventas").delete().eq("mes", mes);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(service, auth, "Mes de ventas eliminado", mesLargo(mes));
  return NextResponse.json({ ok: true });
}
