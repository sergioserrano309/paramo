import { DESC_MAX, estaBloqueada } from "@/config/cotizaciones";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { ACT_ETAPA } from "@/config/prospectos";
import { registrarActividad } from "@/lib/actividad";
import { registrarBitacora } from "@/lib/bitacora";
import { can } from "@/lib/can";
import {
  cargarCotizacion,
  cargarProspectosCotizables,
  puedeEditarCotizacion,
} from "@/lib/cotizaciones";
import { calcularTotales, lineasConPrecioCambiado } from "@/lib/cotizaciones-calculo";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { todayBogota } from "@/lib/format";
import { clientKey, readJsonBody } from "@/lib/http";
import { formatMoneda } from "@/lib/precios";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import type { AuthContext } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CotizacionListItem } from "@/lib/types/cotizacion";

const MAX_BODY_BYTES = 2_048;
const DENIED = "No se pudo actualizar la cotización.";

const bodySchema = z.object({
  accion: z.enum([
    "aprobar",
    "rechazar",
    "enviar",
    "aceptar",
    "no_aceptada",
    "nueva_version",
  ]),
  descuento: z.coerce.number().min(0).max(100).optional(),
  comentario: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(400)),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Etiqueta de bitácora de la decisión del supervisor: descuento, precios o ambos. */
function textoDecision(
  verbo: "aprobado" | "rechazado",
  descuento: boolean,
  precios: boolean,
): string {
  const que = descuento && precios ? "Descuento y precios" : precios ? "Precios" : "Descuento";
  const plural = que === "Descuento" ? verbo : verbo === "aprobado" ? "aprobados" : "rechazados";
  return `${que} ${plural}`;
}

type Transicion = {
  patch: Record<string, unknown>;
  accion: string;
  detalle: string;
  efecto?: () => Promise<void>;
};

/**
 * Orden de las etapas del funnel, para el efecto «enviar» (as-is: solo adelanta el
 * prospecto hasta Propuesta, nunca lo retrocede).
 */
async function ordenEtapas(service: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await service.from("etapas_funnel").select("codigo, orden");
  return new Map((data ?? []).map((e) => [e.codigo as string, e.orden as number]));
}

async function cambiarEtapaProspecto(
  service: SupabaseClient,
  auth: AuthContext,
  prospectoId: string,
  patch: Record<string, unknown>,
  detalle: string,
  textoActividad: string,
): Promise<void> {
  const { error } = await service
    .from("prospectos")
    .update({ ...patch, actualizado_por: auth.userId })
    .eq("id", prospectoId);
  if (error) return;
  await registrarActividad(service, {
    prospectoId,
    tipo: ACT_ETAPA,
    texto: textoActividad,
    usuarioId: auth.userId,
  });
  await registrarBitacora(service, auth, "Cambio de etapa", detalle, {
    tabla: "prospectos",
    id: prospectoId,
  });
}

/**
 * Transiciones de estado de la cotización (as-is qApprove / qReject / qSent / qAccept /
 * qLost / qNewVer). Aprobar y rechazar descuentos es `asignar`; el resto, quien puede
 * editar la cotización.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }

  if (
    !rateLimit(`cotizaciones-estado:${auth.userId}:${clientKey(request)}`, 60, 60_000)
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
  const { accion, descuento, comentario } = parsed.data;

  const service = createServiceClient();
  const cot = await cargarCotizacion(service, id);
  if (!cot) {
    return NextResponse.json({ error: DENIED }, { status: 404 });
  }

  const esDecision = accion === "aprobar" || accion === "rechazar";
  const prospectos = cot.prospecto_id
    ? await cargarProspectosCotizables(service, cot.prospecto_id)
    : [];
  const prospecto = prospectos?.[0] ?? null;

  if (esDecision) {
    if (!can(auth.profile.rol, "asignar")) {
      return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
    }
  } else if (
    !puedeEditarCotizacion(
      auth.profile.rol,
      auth.userId,
      cot,
      prospecto?.responsable_id ?? null,
      prospecto !== null,
    )
  ) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }

  const ahoraISO = new Date().toISOString();
  const hoy = todayBogota();
  const etiqueta = `${cot.numero} · ${cot.cliente_nombre}`;
  let t: Transicion | null = null;

  if (accion === "aprobar" && cot.estado === "pendiente") {
    const sol = cot.desc_solicitado ?? cot.desc_pct;
    const dv = Math.max(0, Math.min(descuento ?? sol, sol));
    const totales = calcularTotales(cot.items, dv, cot.iva_pct, cot.moneda);
    // Los precios que el comercial cambió a mano quedan aprobados con el descuento.
    const preciosAprobados = lineasConPrecioCambiado(cot.items).flatMap((l) =>
      l.producto_id ? [{ producto_id: l.producto_id, precio: l.precio }] : [],
    );
    const pidioDescuento = sol > DESC_MAX;
    t = {
      patch: {
        desc_pct: dv,
        total: totales.tot,
        estado: "final",
        version: cot.version + 1,
        final_en: ahoraISO,
        aprobacion: {
          por: auth.userId,
          en: ahoraISO,
          desc: dv,
          solicitado: sol,
          comentario,
          precios: preciosAprobados,
        },
        rechazo: null,
      },
      accion: textoDecision("aprobado", pidioDescuento, preciosAprobados.length > 0),
      detalle: `${etiqueta} · ${dv}%${dv !== sol ? ` (solicitado ${sol}%)` : ""}${preciosAprobados.length ? ` · ${preciosAprobados.length} precio(s) cambiado(s)` : ""}${comentario ? " · " + comentario : ""}`,
    };
  } else if (accion === "rechazar" && cot.estado === "pendiente") {
    const sol = cot.desc_solicitado ?? cot.desc_pct;
    const nPrecios = lineasConPrecioCambiado(cot.items).length;
    t = {
      patch: {
        estado: "rechazada",
        rechazo: { por: auth.userId, en: ahoraISO, solicitado: sol, comentario },
      },
      accion: textoDecision("rechazado", sol > DESC_MAX, nPrecios > 0),
      detalle: `${etiqueta} · ${sol}%${nPrecios ? ` · ${nPrecios} precio(s) cambiado(s)` : ""}${comentario ? " · " + comentario : ""}`,
    };
  } else if (accion === "enviar" && cot.estado === "final") {
    t = {
      patch: { estado: "enviada", enviada_en: ahoraISO },
      accion: "Cotización enviada",
      detalle: `${etiqueta} · ${formatMoneda(cot.total, cot.moneda)}`,
      efecto: async () => {
        if (!prospecto || !prospecto.activo) return;
        const orden = await ordenEtapas(service);
        const actual = orden.get(prospecto.etapa_codigo);
        const propuesta = orden.get("propuesta");
        const { data: etapa } = await service
          .from("etapas_funnel")
          .select("en_pipeline")
          .eq("codigo", prospecto.etapa_codigo)
          .maybeSingle();
        if (
          actual === undefined ||
          propuesta === undefined ||
          !etapa?.en_pipeline ||
          actual >= propuesta
        ) {
          return;
        }
        await cambiarEtapaProspecto(
          service,
          auth,
          prospecto.id,
          { etapa_codigo: "propuesta", etapa_desde: hoy, ultimo_contacto: hoy },
          `${prospecto.empresa}: ${prospecto.etapa_codigo} → Propuesta enviada (por cotización)`,
          `Pasó a Propuesta enviada (cotización ${cot.numero})`,
        );
      },
    };
  } else if (accion === "aceptar" && cot.estado === "enviada") {
    t = {
      patch: { estado: "aceptada", cerrada_en: ahoraISO },
      accion: "Cotización aceptada",
      detalle: `${etiqueta} · ${formatMoneda(cot.total, cot.moneda)}`,
      efecto: async () => {
        if (!prospecto || prospecto.etapa_codigo === "ganado") return;
        await cambiarEtapaProspecto(
          service,
          auth,
          prospecto.id,
          {
            etapa_codigo: "ganado",
            ganado_en: hoy,
            etapa_desde: hoy,
            activo: true,
            ultimo_contacto: hoy,
          },
          `${prospecto.empresa}: ${prospecto.etapa_codigo} → Ganado (cotización aceptada)`,
          `Pasó a Ganado (cotización ${cot.numero} aceptada)`,
        );
      },
    };
  } else if (accion === "no_aceptada" && cot.estado === "enviada") {
    t = {
      patch: { estado: "no_aceptada", cerrada_en: ahoraISO },
      accion: "Cotización no aceptada",
      detalle: etiqueta,
    };
  } else if (
    accion === "nueva_version" &&
    (["enviada", "aceptada", "no_aceptada"].includes(cot.estado) || estaBloqueada(cot))
  ) {
    t = {
      patch: { estado: "borrador" },
      accion: "Nueva versión en preparación",
      detalle: etiqueta,
    };
  }

  // Transición no permitida desde el estado actual.
  if (!t) {
    return NextResponse.json({ error: DENIED }, { status: 409 });
  }

  const { error } = await service
    .from("cotizaciones")
    .update({ ...t.patch, actualizado_por: auth.userId })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  await registrarBitacora(service, auth, t.accion, t.detalle, {
    tabla: "cotizaciones",
    id,
  });
  if (t.efecto) await t.efecto();

  const actualizada: CotizacionListItem | null = await cargarCotizacion(service, id);
  if (!actualizada) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cotizacion: actualizada });
}
