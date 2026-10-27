import { NextResponse } from "next/server";
import { z } from "zod";
import { isTipoActividad, appendActividad } from "@/lib/actividad";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { isRol } from "@/config/roles";
import { isMotivoInactivo } from "@/config/motivos-inactivo";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { todayBogota } from "@/lib/format";
import {
  canAsignarResponsable,
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
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BODY_BYTES = 16_384;
const DENIED = "No se pudo guardar el prospecto.";
const DELETE_DENIED = "No se pudo eliminar el prospecto.";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max));

const optionalCodigo = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t.slice(0, 80) : null;
  });

const datosSchema = z.object({
  accion: z.literal("datos"),
  empresa: z.string().trim().min(1).max(200),
  nit: optionalText(40),
  contacto: optionalText(120),
  cargo: optionalText(120),
  telefono: optionalText(40),
  email: optionalText(254).refine(
    (v) => v === "" || z.string().email().safeParse(v).success,
    { message: "email" },
  ),
  ciudad: optionalText(120),
  canal_codigo: optionalCodigo,
  fuente_codigo: optionalCodigo,
  valor_mensual_estimado: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? 0 : v),
    z.coerce.number().min(0).max(1_000_000_000_000),
  ),
  notas: optionalText(4_000),
});

const patchSchema = z.discriminatedUnion("accion", [
  datosSchema,
  z.object({
    accion: z.literal("calificacion"),
    calificacion: z.coerce.number().int().min(0).max(3),
  }),
  z.object({
    accion: z.literal("responsable"),
    responsable_id: z.string().uuid(),
  }),
  z.object({
    accion: z.literal("inactivar"),
    motivo: z.string().trim().min(1).max(80),
  }),
  z.object({
    accion: z.literal("reactivar"),
  }),
  z.object({
    accion: z.literal("actividad"),
    tipo: z.string().trim().min(1).max(40),
    texto: z.string().trim().min(1).max(500),
  }),
]);

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function codigoActivo(
  service: SupabaseClient,
  table: "canales" | "fuentes",
  codigo: string | null,
): Promise<boolean> {
  if (!codigo) return true;
  const { data, error } = await service
    .from(table)
    .select("codigo")
    .eq("codigo", codigo)
    .eq("activo", true)
    .maybeSingle();
  return !error && !!data;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`prospectos-patch:${auth.userId}:${clientKey(request)}`, 60, 60_000)
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

  const service = createServiceClient();
  const { data: actual, error: loadError } = await service
    .from("prospectos")
    .select("id, activo, responsable_id, actividad, calificacion")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !actual) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const rol = auth.profile.rol;
  const responsableId = actual.responsable_id as string;
  const canEdit = canEditProspecto(rol, auth.userId, responsableId);
  const body = parsed.data;
  const today = todayBogota();

  if (body.accion === "responsable") {
    if (!canAsignarResponsable(rol, auth.userId, responsableId)) {
      return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
    }
  } else if (!canEdit) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const patch: Record<string, unknown> = { actualizado_por: auth.userId };

  if (body.accion === "datos") {
    if (!(await codigoActivo(service, "canales", body.canal_codigo))) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    if (!(await codigoActivo(service, "fuentes", body.fuente_codigo))) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    Object.assign(patch, {
      empresa: body.empresa,
      nit: body.nit,
      contacto: body.contacto,
      cargo: body.cargo,
      telefono: body.telefono,
      email: body.email,
      ciudad: body.ciudad,
      canal_codigo: body.canal_codigo,
      // El canal define la lista de precios; el tipo propio del prospecto ya no se usa.
      tipo_cliente_codigo: null,
      fuente_codigo: body.fuente_codigo,
      valor_mensual_estimado: body.valor_mensual_estimado,
      notas: body.notas,
    });
  } else if (body.accion === "calificacion") {
    patch.calificacion = body.calificacion;
  } else if (body.accion === "responsable") {
    const { data: responsable, error: respError } = await service
      .from("profiles")
      .select("id, activo, rol")
      .eq("id", body.responsable_id)
      .maybeSingle();
    if (
      respError ||
      !responsable ||
      responsable.activo !== true ||
      !isRol(responsable.rol as string)
    ) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    patch.responsable_id = body.responsable_id;
  } else if (body.accion === "inactivar") {
    if (!isMotivoInactivo(body.motivo)) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    patch.activo = false;
    patch.motivo_inactivo = body.motivo;
    patch.inactivo_en = today;
    patch.actividad = appendActividad(actual.actividad, {
      f: today,
      t: "Estado",
      x: `Inactivado · ${body.motivo}`,
      u: auth.userId,
    });
  } else if (body.accion === "reactivar") {
    patch.activo = true;
    patch.motivo_inactivo = "";
    patch.inactivo_en = null;
    patch.ultimo_contacto = today;
    patch.actividad = appendActividad(actual.actividad, {
      f: today,
      t: "Estado",
      x: "Reactivado",
      u: auth.userId,
    });
  } else if (body.accion === "actividad") {
    if (actual.activo === false) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    if (!isTipoActividad(body.tipo)) {
      return NextResponse.json({ error: DENIED }, { status: 422 });
    }
    patch.ultimo_contacto = today;
    patch.actividad = appendActividad(actual.actividad, {
      f: today,
      t: body.tipo,
      x: body.texto,
      u: auth.userId,
    });
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

  return NextResponse.json({
    ok: true,
    prospecto: mapProspectoRow(updated as unknown as ProspectoRow),
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
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
      `prospectos-delete:${auth.userId}:${clientKey(request)}`,
      20,
      60_000,
    )
  ) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const { data: actual, error: loadError } = await service
    .from("prospectos")
    .select("id, responsable_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !actual) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
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

  const { error: compError } = await service
    .from("compromisos")
    .delete()
    .eq("prospecto_id", id);
  if (compError) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  const { error } = await service.from("prospectos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
