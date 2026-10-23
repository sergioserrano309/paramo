import { NextResponse } from "next/server";
import { z } from "zod";
import { PCT_MAX_LISTA_GENERAL, TIPO_CLIENTE_PVP } from "@/config/productos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiPermission } from "@/lib/permissions";
import { cargarTiposClientePrecio } from "@/lib/productos";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudieron guardar las listas de precios.";

const bodySchema = z.object({
  descuentos: z.record(z.string().max(40), z.coerce.number().finite()),
});

/**
 * Lista general de precios: % de descuento sobre el PVP por tipo de cliente (as-is
 * savePct). Solo `usuarios` (supervisor). El consumidor final siempre paga el PVP.
 */
export async function PATCH(request: Request) {
  const auth = await requireApiPermission("usuarios");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (!rateLimit(`config-precios:${auth.userId}:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 2_048);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const service = createServiceClient();
  const tipos = await cargarTiposClientePrecio(service);
  if (!tipos) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  const editables = tipos.filter((t) => t.codigo !== TIPO_CLIENTE_PVP);
  const validos = new Set(editables.map((t) => t.codigo));
  if (Object.keys(parsed.data.descuentos).some((k) => !validos.has(k))) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  const nuevos = editables.map((t) => {
    const v = parsed.data.descuentos[t.codigo];
    // Como el as-is: valores fuera de rango se acotan en vez de rechazarse.
    const pct = Math.max(0, Math.min(PCT_MAX_LISTA_GENERAL, Number.isFinite(v) ? v : t.descuento_pct));
    return { codigo: t.codigo, nombre: t.nombre, pct: Math.round(pct * 2) / 2 };
  });

  const resultados = await Promise.all(
    nuevos.map((n) =>
      service
        .from("tipos_cliente")
        .update({ descuento_pct_default: n.pct })
        .eq("codigo", n.codigo),
    ),
  );
  if (resultados.some((r) => r.error)) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Listas de precios actualizadas",
    nuevos.map((n) => `${n.nombre} ${n.pct}%`).join(" · "),
  );

  return NextResponse.json({
    ok: true,
    descuentos: Object.fromEntries(nuevos.map((n) => [n.codigo, n.pct])),
  });
}
