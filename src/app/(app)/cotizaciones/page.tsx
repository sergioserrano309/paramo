import { CotizacionesPanel } from "@/components/CotizacionesPanel";
import { can, requireModuleAccess } from "@/lib/permissions";
import {
  cargarCotizaciones,
  cargarProspectosCotizables,
} from "@/lib/cotizaciones";
import { cargarProductos, cargarTiposClientePrecio } from "@/lib/productos";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ abrir?: string; nueva?: string; prospecto?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CotizacionesPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("cotizaciones");
  const sp = await searchParams;
  const service = createServiceClient();

  const [cotizaciones, prospectos, productos, tipos] = await Promise.all([
    cargarCotizaciones(service),
    cargarProspectosCotizables(service),
    cargarProductos(service),
    cargarTiposClientePrecio(service),
  ]);

  const rol = ctx.profile.rol;

  return (
    <CotizacionesPanel
      initialCotizaciones={cotizaciones ?? []}
      prospectos={prospectos ?? []}
      productos={productos ?? []}
      tiposCliente={tipos ?? []}
      cargaFallida={
        cotizaciones === null ||
        prospectos === null ||
        productos === null ||
        tipos === null
      }
      userId={ctx.userId}
      // Enlaces desde la ficha del prospecto, Dashboard y bitácora.
      abrirInicial={sp.abrir && UUID.test(sp.abrir) ? sp.abrir : ""}
      nuevaInicial={sp.nueva === "1"}
      prospectoInicial={sp.prospecto && UUID.test(sp.prospecto) ? sp.prospecto : ""}
      // As-is `editar`: crea y edita cualquier cotización.
      puedeEditarTodo={can(rol, "editar")}
      // As-is `asignar`: aprueba o rechaza descuentos mayores al máximo.
      puedeAprobar={can(rol, "asignar")}
      esSupervisor={rol === "supervisor"}
    />
  );
}
