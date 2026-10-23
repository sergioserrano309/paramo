import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { cargarProducto } from "@/lib/productos";
import { createServiceClient } from "@/lib/supabase-server";
import { pkey } from "@/lib/texto";
import { cargarMesesVentas, resumenVentas } from "@/lib/ventas";
import { rangoDePeriodo } from "@/lib/ventas-periodo";

const DENIED = "No se pudo cargar las ventas del producto.";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Seguimiento de ventas de un producto (últimos 12 meses cargados): total, clientes que
 * compran, serie mensual y principales clientes. Cruza por `producto_clave`.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("productos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`productos-ventas:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const producto = await cargarProducto(service, id);
  if (!producto) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const meses = await cargarMesesVentas(service);
  if (!meses) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  const rango = rangoDePeriodo(
    "12m",
    meses.map((m) => m.mes),
  );
  if (!rango) {
    return NextResponse.json({ valor: 0, unidades: 0, clientes: 0, por_mes: [], top_clientes: [] });
  }

  const clave = pkey(producto.nombre);
  const [porMes, porCliente] = await Promise.all([
    resumenVentas(service, { ...rango, por: "mes", productoClave: clave }),
    resumenVentas(service, { ...rango, por: "cliente", productoClave: clave }),
  ]);
  if (!porMes || !porCliente) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const valorPorMes = new Map(porMes.map((m) => [m.clave, m.valor]));
  return NextResponse.json({
    valor: porMes.reduce((a, m) => a + m.valor, 0),
    unidades: porMes.reduce((a, m) => a + m.unidades, 0),
    clientes: porCliente.length,
    // Serie de los 12 meses cargados, con 0 donde el producto no vendió.
    por_mes: rango.meses.map((m) => ({ mes: m, valor: valorPorMes.get(m) ?? 0 })),
    top_clientes: porCliente.slice(0, 5).map((c) => ({ cliente: c.etiqueta, valor: c.valor })),
  });
}
