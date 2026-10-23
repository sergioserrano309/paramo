import { NextResponse } from "next/server";
import { z } from "zod";
import { FB_TIPOS } from "@/config/productos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiAnyPermission } from "@/lib/permissions";
import { cargarSeguimientoProducto } from "@/lib/productos-seguimiento";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo registrar la retroalimentación.";

const bodySchema = z
  .object({
    tipo: z.enum(FB_TIPOS),
    cliente: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (typeof v === "string" ? v.trim() : ""))
      .pipe(z.string().max(200)),
    calif: z.coerce.number().int().min(0).max(5),
    texto: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (typeof v === "string" ? v.trim() : ""))
      .pipe(z.string().max(1_000)),
  })
  // As-is: hace falta un comentario o una calificación.
  .refine((v) => v.texto !== "" || v.calif > 0);

type RouteParams = { params: Promise<{ id: string }> };

/** Agrega una opinión o degustación al producto (as-is fbForm). Quien edita el catálogo. */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiAnyPermission(["editar", "asignar"]);
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (!rateLimit(`productos-feedback:${auth.userId}:${clientKey(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Escribe un comentario o califica." },
      { status: 422 },
    );
  }
  const { tipo, cliente, calif, texto } = parsed.data;

  const service = createServiceClient();
  const { data: producto } = await service
    .from("productos")
    .select("id, nombre")
    .eq("id", id)
    .maybeSingle();
  if (!producto) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const { error } = await service.from("producto_feedback").insert({
    producto_id: id,
    tipo,
    cliente,
    calif,
    texto,
    usuario_id: auth.userId,
  });
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(
    service,
    auth,
    "Retroalimentación de producto",
    `${producto.nombre} · ${tipo}${cliente ? " en " + cliente : ""}${calif ? ` · ${calif}/5` : ""}`,
    { tabla: "productos", id },
  );

  const seguimiento = await cargarSeguimientoProducto(service, id);
  if (!seguimiento) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...seguimiento }, { status: 201 });
}
