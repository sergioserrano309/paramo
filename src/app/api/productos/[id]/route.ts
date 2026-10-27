import { NextResponse } from "next/server";
import { z } from "zod";
import { estadoProducto } from "@/config/productos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { formatCOP } from "@/lib/precios";
import {
  aplicarPropuestaPrecios,
  cargarProducto,
  cargarTiposClientePrecio,
  productoCamposSchema,
  validarPropuesta,
} from "@/lib/productos";
import { isAuthContext, requireApiAnyPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import type { PrecioProducto } from "@/lib/types/producto";

const MAX_BODY_BYTES = 8_192;
const UPDATE_DENIED = "No se pudo guardar el producto.";
const DELETE_DENIED = "No se pudo eliminar el producto.";

type RouteParams = { params: Promise<{ id: string }> };

/** Edición de ficha y propuesta de precios (as-is prForm sobre un producto existente). */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiAnyPermission(["editar", "asignar"]);
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`productos-update:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: body.status });
  }

  const parsed = productoCamposSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 422 });
  }
  const campos = parsed.data;

  const service = createServiceClient();
  const [actual, tipos] = await Promise.all([
    cargarProducto(service, id),
    cargarTiposClientePrecio(service),
  ]);
  if (!actual) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 404 });
  }
  if (!tipos) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 500 });
  }

  const propuesta = campos.precios as Record<string, PrecioProducto | null>;
  const invalido = validarPropuesta(propuesta, tipos, false);
  if (invalido) {
    return NextResponse.json({ error: invalido }, { status: 422 });
  }

  const esSupervisor = auth.profile.rol === "supervisor";
  const resultado = aplicarPropuestaPrecios({
    vigentes: actual.precios,
    pendientes: actual.precios_pendientes,
    propuesta,
    tipos,
    esSupervisor,
    userId: auth.userId,
    ahoraISO: new Date().toISOString(),
  });

  const { error } = await service
    .from("productos")
    .update({
      nombre: campos.nombre,
      precio_publico: campos.precio_publico,
      linea: campos.linea,
      estado: campos.estado,
      presentacion: campos.presentacion,
      sku: campos.sku,
      codigo: campos.codigo,
      descripcion: campos.descripcion,
      precios: resultado.precios,
      precios_pendientes: resultado.pendientes,
      actualizado_por: auth.userId,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un producto con ese nombre." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 500 });
  }

  const cambiosFicha: string[] = [];
  if (actual.estado !== campos.estado) {
    cambiosFicha.push(
      `estado ${estadoProducto(actual.estado).nombre} → ${estadoProducto(campos.estado).nombre}`,
    );
  }
  if (actual.precio_publico !== campos.precio_publico) {
    cambiosFicha.push(
      `PVP ${formatCOP(actual.precio_publico)} → ${formatCOP(campos.precio_publico)}`,
    );
  }
  if (actual.nombre !== campos.nombre) {
    cambiosFicha.push(`nombre ${actual.nombre} → ${campos.nombre}`);
  }

  const ref = { tabla: "productos", id };
  if (cambiosFicha.length || !resultado.cambios.length) {
    await registrarBitacora(
      service,
      auth,
      "Producto editado",
      `${campos.nombre}${cambiosFicha.length ? " · " + cambiosFicha.join("; ") : ""}`,
      ref,
    );
  }
  if (resultado.cambios.length) {
    await registrarBitacora(
      service,
      auth,
      esSupervisor
        ? "Precios por tipo de cliente definidos"
        : "Precios por tipo de cliente propuestos",
      `${campos.nombre} · ${resultado.cambios.join("; ")}`,
      ref,
    );
  }

  const producto = await cargarProducto(service, id);
  if (!producto) {
    return NextResponse.json({ error: UPDATE_DENIED }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    producto,
    precios_pendientes_nuevos: resultado.cambios.length > 0 && !esSupervisor,
  });
}

/**
 * Borrado real del producto, como el as-is. Las ventas cargadas no se tocan (ventas no
 * depende del catálogo por FK). Alternativa a futuro: solo marcar `descontinuado`.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiAnyPermission(["editar", "asignar"]);
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`productos-delete:${auth.userId}:${clientKey(request)}`, 30, 60_000)
  ) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const actual = await cargarProducto(service, id);
  if (!actual) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
  }

  const { error } = await service.from("productos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  // Sin ref: la fila ya no existe, no hay a qué apuntar.
  await registrarBitacora(service, auth, "Producto eliminado", actual.nombre);
  return NextResponse.json({ ok: true });
}
