import { NextResponse } from "next/server";
import { z } from "zod";
import { FB_TIPOS } from "@/config/productos";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { canEditProspecto } from "@/lib/can";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { cargarFeedbackProspecto } from "@/lib/productos-seguimiento";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const DENIED = "No se pudo registrar la retroalimentación.";

const bodySchema = z
  .object({
    // null = «General»: comentario sobre los productos en conjunto.
    producto_id: z.union([z.string().uuid(), z.null()]),
    tipo: z.enum(FB_TIPOS),
    calif: z.coerce.number().int().min(0).max(5),
    texto: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (typeof v === "string" ? v.trim() : ""))
      .pipe(z.string().max(1_000)),
  })
  // Como en el producto: hace falta un comentario o una calificación.
  .refine((v) => v.texto !== "" || v.calif > 0);

type RouteParams = { params: Promise<{ id: string }> };

/** Agrega una retroalimentación o degustación al prospecto, ligada a un producto o a «General». */
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

  if (!rateLimit(`prospectos-feedback:${auth.userId}:${clientKey(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un comentario o califica." }, { status: 422 });
  }
  const { producto_id, tipo, calif, texto } = parsed.data;

  const service = createServiceClient();
  const [{ data: prospecto }, productoRes] = await Promise.all([
    service.from("prospectos").select("id, empresa, responsable_id").eq("id", id).maybeSingle(),
    producto_id
      ? service.from("productos").select("id, nombre").eq("id", producto_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!prospecto || (producto_id && !productoRes.data)) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }
  if (!canEditProspecto(auth.profile.rol, auth.userId, prospecto.responsable_id as string)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const { error } = await service.from("producto_feedback").insert({
    producto_id,
    prospecto_id: id,
    tipo,
    // El nombre del prospecto queda guardado: la opinión sigue legible aunque se borre.
    cliente: prospecto.empresa as string,
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
    "Retroalimentación de prospecto",
    `${prospecto.empresa} · ${tipo} · ${productoRes.data?.nombre ?? "General"}${calif ? ` · ${calif}/5` : ""}`,
    { tabla: "prospectos", id },
  );

  const feedback = await cargarFeedbackProspecto(service, id);
  if (!feedback) return NextResponse.json({ error: DENIED }, { status: 500 });
  return NextResponse.json({ ok: true, feedback }, { status: 201 });
}
