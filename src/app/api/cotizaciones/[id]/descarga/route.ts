import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { ESTADOS_FINALES } from "@/config/cotizaciones";
import { cargarContactoCliente, cargarCotizacion } from "@/lib/cotizaciones";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey } from "@/lib/http";
import { isAuthContext, requireApiModuleAccess } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { idsProspectosOcultos } from "@/lib/visibilidad";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Prepara la descarga del PDF: deja constancia en la bitácora (as-is quotePDF → log) y
 * devuelve los datos de contacto del cliente que imprime el PDF. El PDF se genera en el
 * navegador; los datos personales se entregan solo aquí, no con el listado.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("cotizaciones");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "No válido." }, { status: 422 });
  }

  if (
    !rateLimit(`cotizaciones-pdf:${auth.userId}:${clientKey(request)}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
  }

  const service = createServiceClient();
  const cot = await cargarCotizacion(service, id);
  if (!cot) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  if (cot.prospecto_id && (await idsProspectosOcultos(service, auth.profile.rol)).has(cot.prospecto_id)) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  const fin = ESTADOS_FINALES.includes(cot.estado);
  await registrarBitacora(
    service,
    auth,
    "PDF de cotización descargado",
    `${cot.numero} · ${cot.cliente_nombre}${fin ? "" : " (borrador)"}`,
    { tabla: "cotizaciones", id },
  );
  const contacto = cot.prospecto_id
    ? await cargarContactoCliente(service, cot.prospecto_id)
    : null;
  return NextResponse.json({ ok: true, contacto });
}
