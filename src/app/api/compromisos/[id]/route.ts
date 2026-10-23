import { NextResponse } from "next/server";
import { z } from "zod";
import { isTipoCompromiso } from "@/config/compromisos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import {
  fetchCompromisoAgendaById,
  prospectoExiste,
  responsableActivo,
} from "@/lib/compromisos";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { isFechaCompromiso, todayBogota } from "@/lib/format";
import {
  canEditCompromiso,
  canToggleCompromiso,
  isAuthContext,
  puedeVerCompromiso,
  requireApiModuleAccess,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import type { CompromisoAgendaItem } from "@/lib/types/compromiso";

const MAX_BODY_BYTES = 16_384;
const DENIED = "No se pudo guardar el compromiso.";
const DELETE_DENIED = "No se pudo eliminar el compromiso.";

const patchSchema = z
  .object({
    titulo: z.string().trim().min(1).max(240).optional(),
    tipo: z.string().trim().min(1).max(40).optional(),
    fecha: z.string().trim().optional(),
    prospecto_id: z.union([z.string().uuid(), z.null()]).optional(),
    notas: z.string().max(4000).optional(),
    responsable_id: z.string().uuid().optional(),
    hecho: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined));

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function accessDe(item: CompromisoAgendaItem) {
  return {
    creadoPor: item.creado_por,
    responsableId: item.responsable_id,
    responsableRol: item.responsable_rol,
  };
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`compromisos-patch:${auth.userId}:${clientKey(request)}`, 60, 60_000)
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const body = parsed.data;
  if (body.tipo !== undefined && !isTipoCompromiso(body.tipo)) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  if (body.fecha !== undefined && !isFechaCompromiso(body.fecha)) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const loaded = await fetchCompromisoAgendaById(service, id);
  if (loaded.error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  if (!loaded.item) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const existing = loaded.item;
  const rol = auth.profile.rol;
  const access = accessDe(existing);

  if (!puedeVerCompromiso(rol, auth.userId, existing.responsable_id)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (
    rol !== "supervisor" &&
    body.responsable_id &&
    body.responsable_id !== existing.responsable_id
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const nextResponsable =
    rol === "supervisor" && body.responsable_id
      ? body.responsable_id
      : existing.responsable_id;

  const nextNotas =
    body.notas !== undefined ? body.notas.trim() : existing.notas;
  if (nextNotas.length > 4000) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const next = {
    titulo: body.titulo ?? existing.titulo,
    tipo: body.tipo ?? existing.tipo,
    fecha: body.fecha ?? existing.fecha,
    prospecto_id:
      body.prospecto_id !== undefined
        ? body.prospecto_id
        : existing.prospecto_id,
    notas: nextNotas,
    hecho: body.hecho !== undefined ? body.hecho : existing.hecho,
  };

  const marking = next.hecho !== existing.hecho;
  const editing =
    next.titulo !== existing.titulo ||
    next.tipo !== existing.tipo ||
    next.fecha !== existing.fecha ||
    next.prospecto_id !== existing.prospecto_id ||
    next.notas !== existing.notas ||
    nextResponsable !== existing.responsable_id;

  if (!marking && !editing) {
    return NextResponse.json({ ok: true, compromiso: existing, prospecto_contacto: null });
  }

  if (marking && !canToggleCompromiso(rol, auth.userId, access)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  if (editing && !canEditCompromiso(rol, auth.userId, access)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (
    nextResponsable &&
    nextResponsable !== existing.responsable_id &&
    !(await responsableActivo(service, nextResponsable))
  ) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    next.prospecto_id &&
    next.prospecto_id !== existing.prospecto_id &&
    !(await prospectoExiste(service, next.prospecto_id))
  ) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const today = todayBogota();
  const patch: Record<string, unknown> = {
    titulo: next.titulo,
    tipo: next.tipo,
    fecha: next.fecha,
    prospecto_id: next.prospecto_id,
    notas: next.notas,
  };

  if (marking) {
    patch.hecho = next.hecho;
    patch.hecho_en = next.hecho ? today : null;
  }

  if (nextResponsable !== existing.responsable_id) {
    patch.responsable_id = nextResponsable;
    if (rol === "supervisor" && nextResponsable) {
      patch.asignado = nextResponsable !== auth.userId;
    }
  }

  const { error: updateError } = await service
    .from("compromisos")
    .update(patch)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const markingDone = next.hecho && !existing.hecho;
  let prospectoContacto: { id: string; ultimo_contacto: string } | null = null;

  if (markingDone && next.prospecto_id) {
    const { data: touched, error: contactoError } = await service
      .from("prospectos")
      .update({
        ultimo_contacto: today,
        actualizado_por: auth.userId,
      })
      .eq("id", next.prospecto_id)
      .select("id");

    if (contactoError) {
      await service
        .from("compromisos")
        .update({
          titulo: existing.titulo,
          tipo: existing.tipo,
          fecha: existing.fecha,
          prospecto_id: existing.prospecto_id,
          notas: existing.notas,
          hecho: existing.hecho,
          hecho_en: existing.hecho_en,
          responsable_id: existing.responsable_id,
          asignado: existing.asignado,
        })
        .eq("id", id);
      return NextResponse.json({ error: DENIED }, { status: 500 });
    }

    if (touched && touched.length > 0) {
      prospectoContacto = {
        id: next.prospecto_id,
        ultimo_contacto: today,
      };
    }
  }

  const fresh = await fetchCompromisoAgendaById(service, id);
  if (fresh.error || !fresh.item) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    compromiso: fresh.item,
    prospecto_contacto: prospectoContacto,
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(
      `compromisos-delete:${auth.userId}:${clientKey(request)}`,
      30,
      60_000,
    )
  ) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const loaded = await fetchCompromisoAgendaById(service, id);
  if (loaded.error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }
  if (!loaded.item) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
  }

  if (
    !canEditCompromiso(auth.profile.rol, auth.userId, accessDe(loaded.item))
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = await service.from("compromisos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
