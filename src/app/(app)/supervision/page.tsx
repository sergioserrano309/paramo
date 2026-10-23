import { PanelAprobaciones } from "@/components/PanelAprobaciones";
import { SupervisionPanel } from "@/components/SupervisionPanel";
import { cargarAprobaciones } from "@/lib/aprobaciones";
import { cargarAccionesBitacora, cargarBitacora } from "@/lib/bitacora-consulta";
import { can, requireModuleAccess } from "@/lib/permissions";
import { cargarObservaciones } from "@/lib/observaciones";
import { cargarTiposClientePrecio } from "@/lib/productos";
import { cargarSupervision } from "@/lib/supervision";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;

type PageProps = { searchParams: Promise<{ dias?: string }> };

export default async function SupervisionPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("supervision");
  const { dias: diasParam } = await searchParams;
  const dias = PERIODOS.find((d) => String(d) === diasParam) ?? 7;
  const service = createServiceClient();

  const tipos = await cargarTiposClientePrecio(service);
  const [datos, observaciones, eventos, acciones, aprobaciones, prospectosRes] =
    await Promise.all([
      cargarSupervision(service, dias),
      cargarObservaciones(service, 50),
      cargarBitacora(service),
      cargarAccionesBitacora(service),
      cargarAprobaciones(
        service,
        ctx.profile.rol,
        ctx.userId,
        new Map((tipos ?? []).map((t) => [t.codigo, t.nombre])),
      ),
      service
        .from("prospectos")
        .select("id, empresa")
        .order("empresa", { ascending: true })
        .limit(1_000),
    ]);

  return (
    <SupervisionPanel
      dias={dias}
      periodos={[...PERIODOS]}
      datos={datos}
      observaciones={observaciones ?? []}
      eventosIniciales={eventos ?? []}
      acciones={acciones}
      tiposCliente={tipos ?? []}
      prospectos={(prospectosRes.data ?? []).map((p) => ({
        id: p.id as string,
        empresa: p.empresa as string,
      }))}
      userId={ctx.userId}
      puedeObservar={can(ctx.profile.rol, "observar")}
      puedeAtender={can(ctx.profile.rol, "editar")}
      // As-is: las listas de precios se editan con la acción `usuarios`.
      puedeEditarPrecios={can(ctx.profile.rol, "usuarios")}
      aprobaciones={<PanelAprobaciones datos={aprobaciones} />}
    />
  );
}
