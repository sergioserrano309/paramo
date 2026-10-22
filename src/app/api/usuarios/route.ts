import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/config/roles";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import {
  isAuthContext,
  requireApiPermission,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 8_192;
const LIST_LIMIT = 200;

const createUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
  rol: z.enum(ROLES),
});

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Mensajes genéricos: no filtrar detalles de Auth/SQL al cliente. */
const CREATE_DENIED = "No se pudo crear el usuario.";
const LIST_DENIED = "No se pudo cargar los usuarios.";

export async function GET() {
  const auth = await requireApiPermission("usuarios");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("id, email, nombre, rol, activo, creado_en")
    .order("nombre", { ascending: true })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }

  return NextResponse.json({ usuarios: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("usuarios");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (!rateLimit(`usuarios-create:${auth.userId}:${clientKey(request)}`, 20, 60_000)) {
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

  const parsed = createUsuarioSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  const { nombre, email, password, rol } = parsed.data;
  const service = createServiceClient();

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });

  if (createError || !created.user) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 400 });
  }

  const userId = created.user.id;

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .insert({
      id: userId,
      email,
      nombre,
      rol,
      activo: true,
    })
    .select("id, email, nombre, rol, activo, creado_en")
    .single();

  if (profileError || !profile) {
    // Evitar Auth huérfano sin autorización de negocio.
    await service.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usuario: profile }, { status: 201 });
}
