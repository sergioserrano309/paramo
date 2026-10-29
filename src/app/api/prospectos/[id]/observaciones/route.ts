import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { can, isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { puedeVerProspecto } from "@/lib/visibilidad";

const MAX_BODY_BYTES = 8_192;
const DENIED = "No se pudo guardar la observación.";

const createSchema = z.object({
  texto: z.string().trim().min(1).max(2000),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

type AutorJoin = { nombre: string } | { nombre: string }[] | null;

type ObsRow = {
  id: string;
  texto: string;
  estado: string;
  respuesta: string;
  autor_id: string | null;
  atendida_en: string | null;
  creado_en: string;
  autor: AutorJoin;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapObs(row: ObsRow) {
  const autor = one(row.autor);
  return {
    id: row.id,
    texto: row.texto,
    estado: row.estado === "atendida" ? "atendida" : "abierta",
    respuesta: row.respuesta ?? "",
    autor_id: row.autor_id,
    autor_nombre: autor?.nombre || "Supervisor",
    atendida_en: row.atendida_en,
    creado_en: row.creado_en,
  };
}

const SELECT = `
  id, texto, estado, respuesta, autor_id, atendida_en, creado_en,
  autor:profiles!observaciones_autor_id_fkey ( nombre )
`;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams,
) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  if (auth.profile.rol === "comercial") {
    const { data: prospecto } = await service
      .from("prospectos")
      .select("responsable_id")
      .eq("id", id)
      .maybeSingle();
    if (!prospecto || !(await puedeVerProspecto(auth.profile.rol, prospecto.responsable_id as string))) {
      return NextResponse.json({ error: DENIED }, { status: 404 });
    }
  }
  const { data, error } = await service
    .from("observaciones")
    .select(SELECT)
    .eq("prospecto_id", id)
    .order("creado_en", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const observaciones = ((data ?? []) as unknown as ObsRow[])
    .map(mapObs)
    .sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "abierta" ? -1 : 1;
      return b.creado_en.localeCompare(a.creado_en);
    });

  return NextResponse.json({ observaciones });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!can(auth.profile.rol, "observar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`obs-create:${auth.userId}:${clientKey(request)}`, 30, 60_000)
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

  const service = createServiceClient();
  const { data: prospecto, error: pError } = await service
    .from("prospectos")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (pError || !prospecto) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const { data: created, error } = await service
    .from("observaciones")
    .insert({
      prospecto_id: id,
      texto: parsed.data.texto,
      estado: "abierta",
      autor_id: auth.userId,
    })
    .select(SELECT)
    .single();

  if (error || !created) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, observacion: mapObs(created as unknown as ObsRow) },
    { status: 201 },
  );
}
