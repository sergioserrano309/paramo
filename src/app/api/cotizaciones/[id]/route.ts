import { estaBloqueada } from "@/config/cotizaciones";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import {
  cargarCotizacion,
  cargarProductosPorId,
  cargarProspectosCotizables,
  cotizacionGuardarSchema,
  esEditable,
  prepararGuardado,
  puedeEditarCotizacion,
} from "@/lib/cotizaciones";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { cargarTiposClientePrecio } from "@/lib/productos";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 16_384;
const SAVE_DENIED = "No se pudo guardar la cotización.";
const DELETE_DENIED = "No se pudo eliminar la cotización.";

type RouteParams = { params: Promise<{ id: string }> };

/** Edición de una cotización existente: guardar borrador o generar versión final. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`cotizaciones-update:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: body.status });
  }
  const parsed = cotizacionGuardarSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }
  const datos = parsed.data;

  const service = createServiceClient();
  const existente = await cargarCotizacion(service, id);
  if (!existente) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 404 });
  }

  const [prospectoActual, prospectoNuevo, tipos, productos] = await Promise.all([
    existente.prospecto_id
      ? cargarProspectosCotizables(service, existente.prospecto_id)
      : Promise.resolve([]),
    cargarProspectosCotizables(service, datos.prospecto_id),
    cargarTiposClientePrecio(service),
    cargarProductosPorId(
      service,
      datos.items.flatMap((i) => (i.producto_id ? [i.producto_id] : [])),
    ),
  ]);

  const actual = prospectoActual?.[0] ?? null;
  if (
    !puedeEditarCotizacion(
      auth.profile.rol,
      auth.userId,
      existente,
      actual?.responsable_id ?? null,
      actual !== null,
    )
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  // As-is qEditable: enviada / aceptada / no_aceptada solo admiten «nueva versión».
  if (!esEditable(existente.estado) || estaBloqueada(existente)) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 409 });
  }

  const prospecto = prospectoNuevo?.[0];
  const tipo = tipos?.find((t) => t.codigo === prospecto?.tipo_cliente_codigo);
  if (!prospecto || !tipos || !productos || !tipo) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }
  // Cambiar de cliente: solo a prospectos vivos que no estén perdidos.
  if (
    prospecto.id !== existente.prospecto_id &&
    (!prospecto.activo || prospecto.etapa_codigo === "perdido")
  ) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }
  if (
    prospecto.id !== existente.prospecto_id &&
    prospecto.responsable_id !== auth.userId
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const guardado = prepararGuardado({
    auth,
    existente,
    body: datos,
    prospecto,
    tipo,
    productos,
    ahoraISO: new Date().toISOString(),
  });
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 422 });
  }

  const { error } = await service
    .from("cotizaciones")
    .update(guardado.campos)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    guardado.accion,
    guardado.detalle(existente.numero),
    { tabla: "cotizaciones", id },
  );

  const cotizacion = await cargarCotizacion(service, id);
  if (!cotizacion) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cotizacion });
}

/** Elimina una cotización. Solo en borrador, como el as-is (el botón solo sale ahí). */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`cotizaciones-delete:${auth.userId}:${clientKey(request)}`, 30, 60_000)
  ) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const existente = await cargarCotizacion(service, id);
  if (!existente) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
  }

  const prospectos = existente.prospecto_id
    ? await cargarProspectosCotizables(service, existente.prospecto_id)
    : [];
  const actual = prospectos?.[0] ?? null;
  if (
    !puedeEditarCotizacion(
      auth.profile.rol,
      auth.userId,
      existente,
      actual?.responsable_id ?? null,
      actual !== null,
    )
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  if (existente.estado !== "borrador") {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 409 });
  }

  const { error } = await service.from("cotizaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Cotización eliminada",
    `${existente.numero} · ${existente.cliente_nombre}`,
  );
  return NextResponse.json({ ok: true });
}
