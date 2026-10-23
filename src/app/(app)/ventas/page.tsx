import { VentasPanel } from "@/components/VentasPanel";
import { can, requireModuleAccess } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase-server";
import { pkey } from "@/lib/texto";
import {
  cargarMesesVentas,
  resumenVentas,
  totalesVentas,
} from "@/lib/ventas";
import { rangoDePeriodo } from "@/lib/ventas-periodo";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const ctx = await requireModuleAccess("ventas");
  const service = createServiceClient();

  const [meses, productosRes] = await Promise.all([
    cargarMesesVentas(service),
    service.from("productos").select("id, nombre").limit(500),
  ]);

  const mesesOk = meses ?? [];
  const rango = rangoDePeriodo(
    "12m",
    mesesOk.map((m) => m.mes),
  );
  const [totales, filas] = rango
    ? await Promise.all([
        totalesVentas(service, rango.desde, rango.hasta),
        resumenVentas(service, { desde: rango.desde, hasta: rango.hasta, por: "cliente" }),
      ])
    : [null, null];

  return (
    <VentasPanel
      meses={mesesOk}
      cargaFallida={meses === null}
      periodoInicial="12m"
      totalesIniciales={totales}
      filasIniciales={filas ?? []}
      catalogo={(productosRes.data ?? []).map((p) => ({
        clave: pkey(p.nombre),
        id: p.id as string,
      }))}
      // As-is: cargar Excel y eliminar meses es `editar`.
      puedeCargar={can(ctx.profile.rol, "editar")}
    />
  );
}
