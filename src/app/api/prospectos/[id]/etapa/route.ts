import { NextResponse } from "next/server";
import { z } from "zod";
import { isMotivoPerdida } from "@/config/motivos-perdida";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { ACT_ETAPA } from "@/config/prospectos";
import { registrarActividad } from "@/lib/actividad";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { todayBogota } from "@/lib/format";
import {
  canEditProspecto,
  isAuthContext,
  requireApiModuleAccess,
} from "@/lib/permissions";
import {
  mapProspectoRow,
  PROSPECTO_SELECT_LIST,
  type ProspectoRow,
} from "@/lib/prospectos";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 4_096;
const DENIED = "No se pudo actualizar la etapa.";

const etapaSchema = z.object({
  etapa_codigo: z.string().trim().min(1).max(40),
  motivo_perdida: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : "")),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Cambia la etapa del prospecto (funnel: drag, → o pasos del drawer).
 * Auth: acceso a módulo funnel + canEditP (editar o soy responsable).
 * Sin bitácora ni actividad en este hito.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("funnel");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`prospectos-etapa:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
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

  const parsed = etapaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const { etapa_codigo: nuevaEtapa, motivo_perdida: motivoRaw } = parsed.data;
  const service = createServiceClient();

  const { data: actual, error: loadError } = await service
    .from("prospectos")
    .select("id, empresa, activo, etapa_codigo, responsable_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  if (
    !canEditProspecto(
      auth.profile.rol,
      auth.userId,
      actual.responsable_id as string,
    )
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (actual.activo === false) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (actual.etapa_codigo === nuevaEtapa) {
    const { data: same, error: sameError } = await service
      .from("prospectos")
      .select(PROSPECTO_SELECT_LIST)
      .eq("id", id)
      .single();
    if (sameError || !same) {
      return NextResponse.json({ error: DENIED }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      prospecto: mapProspectoRow(same as unknown as ProspectoRow),
    });
  }

  const { data: etapa, error: etapaError } = await service
    .from("etapas_funnel")
    .select("codigo, activo")
    .eq("codigo", nuevaEtapa)
    .maybeSingle();

  if (etapaError || !etapa || !etapa.activo) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  let motivoPerdida = "";
  if (nuevaEtapa === "perdido") {
    if (!motivoRaw || !isMotivoPerdida(motivoRaw)) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    motivoPerdida = motivoRaw;
  }

  const today = todayBogota();
  const patch: Record<string, unknown> = {
    etapa_codigo: nuevaEtapa,
    etapa_desde: today,
    motivo_perdida: motivoPerdida,
    actualizado_por: auth.userId,
  };

  if (nuevaEtapa === "ganado") {
    patch.ganado_en = today;
  }

  const { data: updated, error: updateError } = await service
    .from("prospectos")
    .update(patch)
    .eq("id", id)
    .select(PROSPECTO_SELECT_LIST)
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const prospecto = mapProspectoRow(updated as unknown as ProspectoRow);
  await registrarActividad(service, {
    prospectoId: id,
    tipo: ACT_ETAPA,
    texto: `Pasó a ${prospecto.etapa_nombre}${motivoPerdida ? ` · ${motivoPerdida}` : ""}`,
    usuarioId: auth.userId,
  });
  const { data: anterior } = await service
    .from("etapas_funnel")
    .select("nombre")
    .eq("codigo", actual.etapa_codigo)
    .maybeSingle();
  await registrarBitacora(
    service,
    auth,
    "Cambio de etapa",
    `${actual.empresa}: ${anterior?.nombre ?? actual.etapa_codigo} → ${prospecto.etapa_nombre}${motivoPerdida ? ` (${motivoPerdida})` : ""}`,
    { tabla: "prospectos", id },
  );

  return NextResponse.json({ ok: true, prospecto });
}
