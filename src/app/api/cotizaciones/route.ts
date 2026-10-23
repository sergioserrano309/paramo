import { NextResponse } from "next/server";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { can } from "@/lib/can";
import {
  cargarCotizacion,
  cargarCotizaciones,
  cargarProductosPorId,
  cargarProspectosCotizables,
  cotizacionGuardarSchema,
  prepararGuardado,
} from "@/lib/cotizaciones";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { cargarTiposClientePrecio } from "@/lib/productos";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 16_384;
const LIST_DENIED = "No se pudo cargar las cotizaciones.";
const CREATE_DENIED = "No se pudo guardar la cotización.";

export async function GET() {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const cotizaciones = await cargarCotizaciones(createServiceClient());
  if (!cotizaciones) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }
  return NextResponse.json({ cotizaciones });
}

/**
 * Crea una cotización (borrador o versión final).
 * As-is canCreateQ: `editar`, o ser responsable del prospecto elegido.
 */
export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`cotizaciones-create:${auth.userId}:${clientKey(request)}`, 40, 60_000)
  ) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: body.status });
  }
  const parsed = cotizacionGuardarSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  const datos = parsed.data;

  const service = createServiceClient();
  const [prospectos, tipos, productos] = await Promise.all([
    cargarProspectosCotizables(service, datos.prospecto_id),
    cargarTiposClientePrecio(service),
    cargarProductosPorId(
      service,
      datos.items.flatMap((i) => (i.producto_id ? [i.producto_id] : [])),
    ),
  ]);
  const prospecto = prospectos?.[0];
  const tipo = tipos?.find((t) => t.codigo === datos.tipo_cliente_codigo);
  if (!prospecto || !tipos || !productos || !tipo) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }

  // Elegir cliente: solo prospectos vivos que no estén perdidos (as-is `clients`).
  if (!prospecto.activo || prospecto.etapa_codigo === "perdido") {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  if (
    !can(auth.profile.rol, "editar") &&
    prospecto.responsable_id !== auth.userId
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const ahoraISO = new Date().toISOString();
  const guardado = prepararGuardado({
    auth,
    existente: null,
    body: datos,
    prospecto,
    tipo,
    productos,
    ahoraISO,
  });
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 422 });
  }

  const { data: creada, error } = await service
    .from("cotizaciones")
    .insert({ ...guardado.campos, creado_por: auth.userId })
    .select("id, numero")
    .single();

  if (error || !creada) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  const id = creada.id as string;
  await registrarBitacora(
    service,
    auth,
    guardado.accion,
    guardado.detalle(creada.numero as string),
    { tabla: "cotizaciones", id },
  );

  const cotizacion = await cargarCotizacion(service, id);
  if (!cotizacion) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cotizacion }, { status: 201 });
}
