import { NextResponse } from "next/server";
import { z } from "zod";
import { isTipoCompromiso } from "@/config/compromisos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import {
  canCreateCompromiso,
  isAuthContext,
  requireApiModuleAccess,
} from "@/lib/permissions";
import {
  fetchCompromisoAgendaById,
  prospectoExiste,
  responsableActivo,
} from "@/lib/compromisos";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { isFechaCompromiso } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 16_384;
const DENIED = "No se pudo guardar el compromiso.";

const createSchema = z.object({
  titulo: z.string().trim().min(1).max(240),
  tipo: z.string().trim().min(1).max(40),
  fecha: z.string().trim(),
  prospecto_id: z.union([z.string().uuid(), z.null()]).optional(),
  notas: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(4000)),
  responsable_id: z.string().uuid().optional(),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!canCreateCompromiso(auth.profile.rol)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`compromisos-create:${auth.userId}:${clientKey(request)}`, 40, 60_000)
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const body = parsed.data;
  if (!isTipoCompromiso(body.tipo) || !isFechaCompromiso(body.fecha)) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  // El comercial siempre agenda para sí mismo, aunque el body traiga otro id.
  const responsableId =
    auth.profile.rol === "supervisor"
      ? (body.responsable_id ?? auth.userId)
      : auth.userId;

  const service = createServiceClient();

  if (!(await responsableActivo(service, responsableId))) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const prospectoId = body.prospecto_id ?? null;
  if (prospectoId && !(await prospectoExiste(service, prospectoId))) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const asignado =
    auth.profile.rol === "supervisor" && responsableId !== auth.userId;

  const { data: created, error } = await service
    .from("compromisos")
    .insert({
      titulo: body.titulo,
      tipo: body.tipo,
      fecha: body.fecha,
      prospecto_id: prospectoId,
      notas: body.notas,
      hecho: false,
      hecho_en: null,
      asignado,
      responsable_id: responsableId,
      creado_por: auth.userId,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const loaded = await fetchCompromisoAgendaById(service, created.id as string);
  if (loaded.error || !loaded.item) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, compromiso: loaded.item },
    { status: 201 },
  );
}
