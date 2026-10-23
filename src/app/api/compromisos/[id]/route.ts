import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import {
  cargarCompromiso,
  compromisoSchema,
  responsableValido,
} from "@/lib/compromisos";
import { puedeEditarCompromiso } from "@/lib/compromisos-permisos";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { fechaCorta } from "@/lib/fechas";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 4_096;
const SAVE_DENIED = "No se pudo guardar el compromiso.";
const DELETE_DENIED = "No se pudo eliminar el compromiso.";

type RouteParams = { params: Promise<{ id: string }> };

/** Edita un compromiso (as-is cForm con `old`). Solo el supervisor reasigna. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("compromisos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`compromisos-update:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: body.status });
  }
  const parsed = compromisoSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }
  const datos = parsed.data;

  const service = createServiceClient();
  const anterior = await cargarCompromiso(service, id);
  if (!anterior) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 404 });
  }
  const rol = auth.profile.rol;
  if (!puedeEditarCompromiso(rol, auth.userId, anterior)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const esSupervisor = rol === "supervisor";
  const responsableId = esSupervisor
    ? (datos.responsable_id ?? auth.userId)
    : anterior.responsable_id;
  const responsable = await responsableValido(service, responsableId);
  // El responsable actual puede haberse desactivado: solo se exige válido si cambia.
  if (!responsable && responsableId !== anterior.responsable_id) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }

  let empresa = anterior.prospecto_empresa ?? "";
  if (datos.prospecto_id && datos.prospecto_id !== anterior.prospecto_id) {
    const { data: p } = await service
      .from("prospectos")
      .select("empresa")
      .eq("id", datos.prospecto_id)
      .maybeSingle();
    if (!p) {
      return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
    }
    empresa = p.empresa as string;
  }
  if (!datos.prospecto_id) empresa = "";

  const asignado = esSupervisor ? responsableId !== auth.userId : anterior.asignado;
  const { error } = await service
    .from("compromisos")
    .update({
      titulo: datos.titulo,
      tipo: datos.tipo,
      fecha: datos.fecha,
      prospecto_id: datos.prospecto_id ?? null,
      notas: datos.notas,
      responsable_id: responsableId,
      asignado,
      actualizado_por: auth.userId,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
  }

  const reasignado = responsableId !== anterior.responsable_id;
  const nombreResp = responsable?.nombre ?? anterior.responsable_nombre;
  await registrarBitacora(
    service,
    auth,
    reasignado ? "Compromiso reasignado" : "Compromiso editado",
    `${empresa ? empresa + ": " : ""}${datos.titulo} · ${fechaCorta(datos.fecha)} · responsable ${nombreResp}${reasignado ? ` (antes ${anterior.responsable_nombre})` : ""}${anterior.fecha !== datos.fecha ? ` · fecha antes ${fechaCorta(anterior.fecha)}` : ""}`,
    datos.prospecto_id ? { tabla: "prospectos", id: datos.prospecto_id } : undefined,
  );

  const compromiso = await cargarCompromiso(service, id);
  if (!compromiso) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, compromiso });
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
    !rateLimit(`compromisos-delete:${auth.userId}:${clientKey(request)}`, 30, 60_000)
  ) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const actual = await cargarCompromiso(service, id);
  if (!actual) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
  }
  if (!puedeEditarCompromiso(auth.profile.rol, auth.userId, actual)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = await service.from("compromisos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  await registrarBitacora(service, auth, "Compromiso eliminado", actual.titulo);
  return NextResponse.json({ ok: true });
}
