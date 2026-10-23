import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { normalizarPrecio, textoPrecio } from "@/lib/precios";
import { cargarProducto, cargarTiposClientePrecio } from "@/lib/productos";
import { isAuthContext, requireApiPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 1_024;
const DENIED = "No se pudo resolver el precio.";

const bodySchema = z.object({
  accion: z.enum(["aprobar", "rechazar"]),
  tipo: z.string().trim().min(1).max(40),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Aprueba o rechaza un precio propuesto por el comercial (as-is ppOk / ppNo).
 * Solo `asignar` (supervisor).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiPermission("asignar");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`productos-precio:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  const { accion, tipo } = parsed.data;

  const service = createServiceClient();
  const [producto, tipos] = await Promise.all([
    cargarProducto(service, id),
    cargarTiposClientePrecio(service),
  ]);
  const pendiente = producto?.precios_pendientes[tipo];
  if (!producto || !tipos || !pendiente) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const precios = { ...producto.precios };
  const pendientes: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(producto.precios_pendientes)) {
    if (k === tipo) continue;
    pendientes[k] = { modo: p.modo, v: p.v, por: p.por, en: p.en };
  }

  const propuesto = normalizarPrecio({ modo: pendiente.modo, v: pendiente.v });
  if (accion === "aprobar") {
    if (propuesto) precios[tipo] = propuesto;
    else delete precios[tipo];
  }

  const { error } = await service
    .from("productos")
    .update({
      precios,
      precios_pendientes: pendientes,
      actualizado_por: auth.userId,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const etiqueta = tipos.find((t) => t.codigo === tipo)?.nombre ?? tipo;
  await registrarBitacora(
    service,
    auth,
    accion === "aprobar" ? "Precio especial aprobado" : "Precio especial rechazado",
    `${producto.nombre} · ${etiqueta}: ${textoPrecio(propuesto)} · propuesto por ${pendiente.por_nombre}`,
    { tabla: "productos", id },
  );

  const actualizado = await cargarProducto(service, id);
  if (!actualizado) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, producto: actualizado });
}
