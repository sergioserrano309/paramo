import { NextResponse } from "next/server";
import { z } from "zod";
import { isRol } from "@/config/roles";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import {
  isAuthContext,
  requireApiAnyPermission,
  requireApiModuleAccess,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { hasSupabaseServiceConfig } from "@/lib/env";
import {
  mapProspectoRow,
  PROSPECTO_SELECT_LIST,
  type ProspectoRow,
} from "@/lib/prospectos";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 16_384;
const LIST_LIMIT = 500;

/** Como el as-is: solo empresa es obligatoria; null / "" / omitido → vacío o null. */
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

const optionalNonNegNumber = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? 0 : v),
    z.coerce.number().min(0).max(max),
  );

const createProspectoSchema = z.object({
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
  tipo_cliente_codigo: optionalCodigo,
  fuente_codigo: optionalCodigo,
  etapa_codigo: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (typeof v !== "string" || !v.trim()) return "prospecto";
      return v.trim().slice(0, 40);
    }),
  valor_mensual_estimado: optionalNonNegNumber(1_000_000_000_000),
  calificacion: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? 0 : v),
    z.coerce.number().int().min(0).max(3),
  ),
  notas: optionalText(4_000),
  // As-is: d.responsable || yo. Si viene null/omitido, la API usa auth.userId.
  responsable_id: z
    .union([z.string().uuid(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v : null)),
});

const CREATE_DENIED = "No se pudo crear el prospecto.";
const LIST_DENIED = "No se pudo cargar los prospectos.";

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET() {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("prospectos")
    .select(PROSPECTO_SELECT_LIST)
    .order("calificacion", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }

  const prospectos = ((data ?? []) as unknown as ProspectoRow[]).map(
    mapProspectoRow,
  );
  return NextResponse.json({ prospectos });
}

export async function POST(request: Request) {
  const auth = await requireApiAnyPermission(["editar", "asignar"]);
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`prospectos-create:${auth.userId}:${clientKey(request)}`, 40, 60_000)
  ) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  const parsed = createProspectoSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  const body = parsed.data;
  const responsableId = body.responsable_id ?? auth.userId;
  const service = createServiceClient();

  const { data: responsable, error: respError } = await service
    .from("profiles")
    .select("id, activo, rol")
    .eq("id", responsableId)
    .maybeSingle();

  if (respError || !responsable || !responsable.activo || !isRol(responsable.rol)) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  const { data: etapa, error: etapaError } = await service
    .from("etapas_funnel")
    .select("codigo, en_pipeline, activo")
    .eq("codigo", body.etapa_codigo)
    .maybeSingle();

  // Alta: solo etapas en pipeline (como STAGES.slice(0,5) del as-is).
  if (etapaError || !etapa || !etapa.activo || !etapa.en_pipeline) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  async function codigoActivo(
    table: "canales" | "fuentes" | "tipos_cliente",
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

  if (!(await codigoActivo("canales", body.canal_codigo))) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  if (!(await codigoActivo("fuentes", body.fuente_codigo))) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  if (!(await codigoActivo("tipos_cliente", body.tipo_cliente_codigo))) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });

  const { data: created, error: insertError } = await service
    .from("prospectos")
    .insert({
      empresa: body.empresa,
      nit: body.nit,
      contacto: body.contacto,
      cargo: body.cargo,
      telefono: body.telefono,
      email: body.email,
      ciudad: body.ciudad,
      canal_codigo: body.canal_codigo,
      tipo_cliente_codigo: body.tipo_cliente_codigo,
      fuente_codigo: body.fuente_codigo,
      etapa_codigo: body.etapa_codigo,
      valor_mensual_estimado: body.valor_mensual_estimado,
      calificacion: body.calificacion,
      notas: body.notas,
      activo: true,
      etapa_desde: today,
      ultimo_contacto: today,
      responsable_id: responsableId,
      creado_por: auth.userId,
      actualizado_por: auth.userId,
    })
    .select(PROSPECTO_SELECT_LIST)
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      prospecto: mapProspectoRow(created as unknown as ProspectoRow),
    },
    { status: 201 },
  );
}
