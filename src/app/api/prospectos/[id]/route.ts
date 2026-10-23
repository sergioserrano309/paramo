import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { can, canEditProspecto } from "@/lib/can";
import { CALIF_TXT } from "@/config/prospectos";
import { isRol } from "@/config/roles";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { cargarFicha, codigoCatalogoActivo } from "@/lib/ficha-prospecto";
import { formatMoneyShort } from "@/lib/format";
import { clientKey, readJsonBody } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 8_192;
const LOAD_DENIED = "No se pudo cargar el prospecto.";
const SAVE_DENIED = "No se pudo guardar el prospecto.";
const DELETE_DENIED = "No se pudo eliminar el prospecto.";

type RouteParams = { params: Promise<{ id: string }> };

const texto = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max));

const codigo = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null));

/** Un solo cambio por llamada: datos de la ficha, calificación o responsable. */
const cambioSchema = z.union([
  z.object({
    tipo: z.literal("datos"),
    empresa: z.string().trim().min(1).max(200),
    nit: texto(40),
    contacto: texto(120),
    cargo: texto(120),
    telefono: texto(40),
    email: texto(254).refine((v) => v === "" || z.string().email().safeParse(v).success),
    ciudad: texto(120),
    canal_codigo: codigo,
    tipo_cliente_codigo: codigo,
    fuente_codigo: codigo,
    valor_mensual_estimado: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? 0 : v),
      z.coerce.number().min(0).max(1_000_000_000_000),
    ),
    notas: texto(4_000),
  }),
  z.object({ tipo: z.literal("calificacion"), calificacion: z.coerce.number().int().min(0).max(3) }),
  z.object({ tipo: z.literal("responsable"), responsable_id: z.string().uuid() }),
]);

const ETIQUETAS: Record<string, string> = {
  empresa: "Empresa",
  nit: "NIT",
  contacto: "Contacto",
  cargo: "Cargo",
  telefono: "Teléfono",
  email: "Correo",
  ciudad: "Ciudad",
  canal_codigo: "Canal",
  tipo_cliente_codigo: "Tipo de cliente",
  fuente_codigo: "Fuente",
  valor_mensual_estimado: "Venta mensual",
  notas: "Notas",
};

/** Ficha completa del prospecto (as-is openProspect): datos, historial y relacionados. */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: LOAD_DENIED }, { status: 422 });
  }

  const ficha = await cargarFicha(createServiceClient(), id, auth.profile.rol);
  if (!ficha) {
    return NextResponse.json({ error: LOAD_DENIED }, { status: 404 });
  }
  return NextResponse.json({ ficha });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }

  if (!rateLimit(`prospectos-edit:${auth.userId}:${clientKey(request)}`, 80, 60_000)) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: body.status });
  }
  const parsed = cambioSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
  }
  const cambio = parsed.data;

  const service = createServiceClient();
  const { data: actual, error: loadError } = await service
    .from("prospectos")
    .select(
      "id, empresa, nit, contacto, cargo, telefono, email, ciudad, canal_codigo, tipo_cliente_codigo, fuente_codigo, valor_mensual_estimado, notas, calificacion, responsable_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (loadError || !actual) {
    return NextResponse.json({ error: SAVE_DENIED }, { status: 404 });
  }

  const rol = auth.profile.rol;
  const puedeEditar = canEditProspecto(rol, auth.userId, actual.responsable_id as string);
  // Reasignar: quien puede editar o el supervisor (`asignar`), como el as-is.
  const permitido =
    cambio.tipo === "responsable" ? puedeEditar || can(rol, "asignar") : puedeEditar;
  if (!permitido) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const ref = { tabla: "prospectos", id };
  const empresa = actual.empresa as string;

  if (cambio.tipo === "calificacion") {
    const { error } = await service
      .from("prospectos")
      .update({ calificacion: cambio.calificacion, actualizado_por: auth.userId })
      .eq("id", id);
    if (error) return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
    await registrarBitacora(
      service,
      auth,
      "Calificación",
      `${empresa}: ${cambio.calificacion ? "★".repeat(cambio.calificacion) + " " : ""}${CALIF_TXT[cambio.calificacion]}`,
      ref,
    );
  } else if (cambio.tipo === "responsable") {
    const { data: nuevo } = await service
      .from("profiles")
      .select("id, nombre, rol, activo")
      .eq("id", cambio.responsable_id)
      .maybeSingle();
    if (!nuevo || !nuevo.activo || !isRol(nuevo.rol)) {
      return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
    }
    const { data: anterior } = await service
      .from("profiles")
      .select("nombre")
      .eq("id", actual.responsable_id as string)
      .maybeSingle();
    const { error } = await service
      .from("prospectos")
      .update({ responsable_id: cambio.responsable_id, actualizado_por: auth.userId })
      .eq("id", id);
    if (error) return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
    await registrarBitacora(
      service,
      auth,
      "Responsable asignado",
      `${empresa}: ${anterior?.nombre ?? "—"} → ${nuevo.nombre}`,
      ref,
    );
  } else {
    const { tipo: _tipo, ...datos } = cambio;
    void _tipo;
    if (
      !(await codigoCatalogoActivo(service, "canales", datos.canal_codigo)) ||
      !(await codigoCatalogoActivo(service, "fuentes", datos.fuente_codigo)) ||
      !(await codigoCatalogoActivo(service, "tipos_cliente", datos.tipo_cliente_codigo))
    ) {
      return NextResponse.json({ error: SAVE_DENIED }, { status: 422 });
    }
    const cambios = (Object.keys(ETIQUETAS) as Array<keyof typeof datos>)
      .filter((k) => String(actual[k] ?? "") !== String(datos[k] ?? ""))
      .map((k) => {
        if (k === "valor_mensual_estimado") {
          return `${ETIQUETAS[k]}: ${formatMoneyShort(Number(actual[k]) || 0)} → ${formatMoneyShort(datos[k])}`;
        }
        if (k === "notas") return "Notas";
        return `${ETIQUETAS[k]}: ${String(actual[k] ?? "") || "—"} → ${String(datos[k] ?? "") || "—"}`;
      });
    const { error } = await service
      .from("prospectos")
      .update({ ...datos, actualizado_por: auth.userId })
      .eq("id", id);
    if (error) return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
    if (cambios.length) {
      await registrarBitacora(
        service,
        auth,
        "Prospecto editado",
        `${datos.empresa} · ${cambios.join("; ")}`,
        ref,
      );
    }
  }

  const ficha = await cargarFicha(service, id, rol);
  if (!ficha) return NextResponse.json({ error: SAVE_DENIED }, { status: 500 });
  return NextResponse.json({ ok: true, ficha });
}

/** Elimina el prospecto y sus compromisos (as-is delPOk). Su historial se va en cascada. */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("prospectos");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 422 });
  }

  if (!rateLimit(`prospectos-delete:${auth.userId}:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 429 });
  }

  const service = createServiceClient();
  const { data: actual } = await service
    .from("prospectos")
    .select("id, empresa, responsable_id")
    .eq("id", id)
    .maybeSingle();
  if (!actual) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 404 });
  }
  if (!canEditProspecto(auth.profile.rol, auth.userId, actual.responsable_id as string)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  await service.from("compromisos").delete().eq("prospecto_id", id);
  const { error } = await service.from("prospectos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: DELETE_DENIED }, { status: 500 });
  }

  await registrarBitacora(service, auth, "Prospecto eliminado", actual.empresa as string);
  return NextResponse.json({ ok: true });
}
