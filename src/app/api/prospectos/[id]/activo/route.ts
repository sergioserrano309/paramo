import { NextResponse } from "next/server";
import { z } from "zod";
import { ACT_ESTADO, MOTIVOS_INACTIVO } from "@/config/prospectos";
import { registrarActividad } from "@/lib/actividad";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { canEditProspecto } from "@/lib/can";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { cargarFicha } from "@/lib/ficha-prospecto";
import { todayBogota } from "@/lib/format";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo cambiar el estado del prospecto.";

const bodySchema = z.discriminatedUnion("activo", [
  z.object({ activo: z.literal(false), motivo: z.enum(MOTIVOS_INACTIVO) }),
  z.object({ activo: z.literal(true) }),
]);

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Inactiva o reactiva un prospecto (as-is inactOk / react). Inactivo = sale del funnel y de
 * los indicadores; no se borra.
 */
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

  if (!rateLimit(`prospectos-activo:${auth.userId}:${clientKey(request)}`, 40, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 1_024);
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

  const hoy = todayBogota();
  const ref = { tabla: "prospectos", id };

  if (parsed.data.activo === false) {
    const motivo = parsed.data.motivo;
    const { error } = await service
      .from("prospectos")
      .update({
        activo: false,
        inactivo_en: hoy,
        motivo_inactivo: motivo,
        actualizado_por: auth.userId,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: DENIED }, { status: 500 });
    await registrarActividad(service, {
      prospectoId: id,
      tipo: ACT_ESTADO,
      texto: `Inactivado · ${motivo}`,
      usuarioId: auth.userId,
    });
    await registrarBitacora(service, auth, "Prospecto inactivado", `${actual.empresa} · ${motivo}`, ref);
  } else {
    const { error } = await service
      .from("prospectos")
      .update({
        activo: true,
        inactivo_en: null,
        motivo_inactivo: "",
        ultimo_contacto: hoy,
        actualizado_por: auth.userId,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: DENIED }, { status: 500 });
    await registrarActividad(service, {
      prospectoId: id,
      tipo: ACT_ESTADO,
      texto: "Reactivado",
      usuarioId: auth.userId,
    });
    await registrarBitacora(service, auth, "Prospecto reactivado", actual.empresa as string, ref);
  }

  const ficha = await cargarFicha(service, id, auth.profile.rol, auth.userId);
  if (!ficha) return NextResponse.json({ error: DENIED }, { status: 500 });
  return NextResponse.json({ ok: true, ficha });
}
