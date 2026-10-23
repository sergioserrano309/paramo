import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { cargarMesesVentas, resumenVentas, totalesVentas } from "@/lib/ventas";
import { esPeriodoValido, rangoDePeriodo } from "@/lib/ventas-periodo";

const DENIED = "No se pudo cargar las ventas.";

const querySchema = z.object({
  periodo: z.string().refine(esPeriodoValido),
  por: z.enum(["cliente", "producto"]),
  cliente: z.string().trim().min(1).max(200).optional(),
});

/**
 * Agregados de ventas de un período, por cliente o por producto. Con `cliente`, devuelve
 * los productos de ese cliente (as-is: expandir una fila de «Por cliente»).
 */
export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("ventas");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (!rateLimit(`ventas-resumen:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    periodo: sp.get("periodo") ?? "12m",
    por: sp.get("por") ?? "cliente",
    cliente: sp.get("cliente") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  const { periodo, por, cliente } = parsed.data;

  const service = createServiceClient();
  const meses = await cargarMesesVentas(service);
  if (!meses) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  const rango = rangoDePeriodo(
    periodo,
    meses.map((m) => m.mes),
  );
  if (!rango) {
    return NextResponse.json({
      periodo,
      totales: { valor: 0, unidades: 0, clientes: 0, filas: 0 },
      filas: [],
    });
  }

  const [totales, filas] = await Promise.all([
    cliente ? Promise.resolve(null) : totalesVentas(service, rango.desde, rango.hasta),
    resumenVentas(service, {
      desde: rango.desde,
      hasta: rango.hasta,
      // Con cliente se piden sus productos, sin importar la pestaña.
      por: cliente ? "producto" : por,
      cliente: cliente ?? null,
    }),
  ]);
  if (!filas || (!cliente && !totales)) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  return NextResponse.json({ periodo, totales, filas });
}
