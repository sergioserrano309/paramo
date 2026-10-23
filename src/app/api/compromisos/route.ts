import { NextResponse } from "next/server";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { can } from "@/lib/can";
import {
  cargarCompromiso,
  cargarCompromisos,
  compromisoSchema,
  responsableValido,
} from "@/lib/compromisos";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { fechaCorta } from "@/lib/fechas";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 4_096;
const LIST_DENIED = "No se pudo cargar los compromisos.";
const CREATE_DENIED = "No se pudo guardar el compromiso.";

export async function GET() {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const compromisos = await cargarCompromisos(createServiceClient(), auth.profile.rol);
  if (!compromisos) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }
  return NextResponse.json({ compromisos });
}

/** Crea un compromiso. As-is: `editar` o `asignar`. Solo el supervisor elige responsable. */
export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  const rol = auth.profile.rol;
  if (!can(rol, "editar") && !can(rol, "asignar")) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`compromisos-create:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: body.status });
  }
  const parsed = compromisoSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  const datos = parsed.data;
  const esSupervisor = rol === "supervisor";

  const service = createServiceClient();
  const responsableId = esSupervisor ? (datos.responsable_id ?? auth.userId) : auth.userId;
  const responsable = await responsableValido(service, responsableId);
  if (!responsable) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  let empresa = "";
  if (datos.prospecto_id) {
    const { data: p } = await service
      .from("prospectos")
      .select("empresa")
      .eq("id", datos.prospecto_id)
      .maybeSingle();
    if (!p) {
      return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
    }
    empresa = p.empresa as string;
  }

  const asignado = esSupervisor && responsableId !== auth.userId;
  const { data: creado, error } = await service
    .from("compromisos")
    .insert({
      titulo: datos.titulo,
      tipo: datos.tipo,
      fecha: datos.fecha,
      prospecto_id: datos.prospecto_id ?? null,
      notas: datos.notas,
      responsable_id: responsableId,
      asignado,
      creado_por: auth.userId,
      actualizado_por: auth.userId,
    })
    .select("id")
    .single();
  if (error || !creado) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  const id = creado.id as string;
  await registrarBitacora(
    service,
    auth,
    asignado ? "Tarea asignada" : "Compromiso creado",
    `${empresa ? empresa + ": " : ""}${datos.titulo} · ${fechaCorta(datos.fecha)} · responsable ${responsable.nombre}`,
    datos.prospecto_id ? { tabla: "prospectos", id: datos.prospecto_id } : undefined,
  );

  const compromiso = await cargarCompromiso(service, id);
  if (!compromiso) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, compromiso }, { status: 201 });
}
