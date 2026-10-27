import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { canEditProspecto } from "@/lib/can";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { cargarFicha } from "@/lib/ficha-prospecto";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo actualizar el producto de interés.";

const bodySchema = z.object({
  producto_id: z.string().uuid(),
  interesado: z.boolean(),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Marca o quita un producto de interés del prospecto (as-is togInt). */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`prospectos-interes:${auth.userId}:${clientKey(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 1_024);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  const { producto_id, interesado } = parsed.data;

  const service = createServiceClient();
  const [{ data: prospecto }, { data: producto }] = await Promise.all([
    service.from("prospectos").select("id, empresa, responsable_id").eq("id", id).maybeSingle(),
    service.from("productos").select("id, nombre").eq("id", producto_id).maybeSingle(),
  ]);
  if (!prospecto || !producto) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (!canEditProspecto(auth.profile.rol, auth.userId, prospecto.responsable_id as string)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = interesado
    ? await service
        .from("prospecto_productos")
        .upsert(
          { prospecto_id: id, producto_id, creado_por: auth.userId },
          { onConflict: "prospecto_id,producto_id", ignoreDuplicates: true },
        )
    : await service
        .from("prospecto_productos")
        .delete()
        .eq("prospecto_id", id)
        .eq("producto_id", producto_id);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Producto de interés",
    `${prospecto.empresa}: ${interesado ? "agregó" : "quitó"} ${producto.nombre}`,
    { tabla: "prospectos", id },
  );

  const ficha = await cargarFicha(service, id, auth.profile.rol, auth.userId);
  if (!ficha) return NextResponse.json({ error: DENIED }, { status: 500 });
  return NextResponse.json({ ok: true, ficha });
}
