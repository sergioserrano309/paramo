import { NextResponse } from "next/server";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { registrarBitacora } from "@/lib/bitacora";
import {
  aplicarPropuestaPrecios,
  cargarProducto,
  cargarProductos,
  cargarTiposClientePrecio,
  productoCamposSchema,
  validarPropuesta,
} from "@/lib/productos";
import {
  isAuthContext,
  requireApiAnyPermission,
  requireApiModuleAccess,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { estadoProducto } from "@/config/productos";
import type { PrecioProducto } from "@/lib/types/producto";

const MAX_BODY_BYTES = 8_192;
const LIST_DENIED = "No se pudo cargar los productos.";
const CREATE_DENIED = "No se pudo crear el producto.";

export async function GET() {
  const auth = await requireApiModuleAccess("productos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const productos = await cargarProductos(createServiceClient());
  if (!productos) {
    return NextResponse.json({ error: LIST_DENIED }, { status: 500 });
  }
  return NextResponse.json({ productos });
}

/** Alta de producto (as-is canEditProd: editar o asignar). */
export async function POST(request: Request) {
  const auth = await requireApiAnyPermission(["editar", "asignar"]);
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (
    !rateLimit(`productos-create:${auth.userId}:${clientKey(request)}`, 40, 60_000)
  ) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: body.status });
  }

  const parsed = productoCamposSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 422 });
  }
  const campos = parsed.data;

  const service = createServiceClient();
  const tipos = await cargarTiposClientePrecio(service);
  if (!tipos) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  // Alta: todos los tipos de cliente (salvo consumidor final) exigen precio, como el as-is.
  const propuesta = campos.precios as Record<string, PrecioProducto | null>;
  const invalido = validarPropuesta(propuesta, tipos, true);
  if (invalido) {
    return NextResponse.json({ error: invalido }, { status: 422 });
  }

  const resultado = aplicarPropuestaPrecios({
    vigentes: {},
    pendientes: {},
    propuesta,
    tipos,
    esSupervisor: auth.profile.rol === "supervisor",
    userId: auth.userId,
    ahoraISO: new Date().toISOString(),
  });

  const { data: creado, error } = await service
    .from("productos")
    .insert({
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
      creado_por: auth.userId,
      actualizado_por: auth.userId,
    })
    .select("id")
    .single();

  if (error || !creado) {
    // 23505 = unique_violation: ya existe un producto con ese nombre.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un producto con ese nombre." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }

  const id = creado.id as string;
  const ref = { tabla: "productos", id };
  await registrarBitacora(
    service,
    auth,
    "Producto creado",
    `${campos.nombre} (${estadoProducto(campos.estado).nombre})`,
    ref,
  );
  if (resultado.cambios.length) {
    await registrarBitacora(
      service,
      auth,
      auth.profile.rol === "supervisor"
        ? "Precios por tipo de cliente definidos"
        : "Precios por tipo de cliente propuestos",
      `${campos.nombre} · ${resultado.cambios.join("; ")}`,
      ref,
    );
  }

  const producto = await cargarProducto(service, id);
  if (!producto) {
    return NextResponse.json({ error: CREATE_DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, producto }, { status: 201 });
}
