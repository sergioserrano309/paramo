import { ProductosPanel } from "@/components/ProductosPanel";
import { can, requireModuleAccess } from "@/lib/permissions";
import {
  cargarProductos,
  cargarTiposClientePrecio,
} from "@/lib/productos";
import { resumenSeguimientoProductos } from "@/lib/productos-seguimiento";
import { createServiceClient } from "@/lib/supabase-server";
import { cargarMesesVentas, resumenVentas } from "@/lib/ventas";
import { rangoDePeriodo } from "@/lib/ventas-periodo";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ abrir?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductosPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("productos");
  const sp = await searchParams;
  const service = createServiceClient();

  const [productos, tipos, meses, resumen] = await Promise.all([
    cargarProductos(service),
    cargarTiposClientePrecio(service),
    cargarMesesVentas(service),
    resumenSeguimientoProductos(service),
  ]);

  // Ventas de los últimos 12 meses cargados por producto (tarjetas del catálogo).
  const rango = rangoDePeriodo(
    "12m",
    (meses ?? []).map((m) => m.mes),
  );
  const ventas = rango
    ? await resumenVentas(service, { ...rango, por: "producto" })
    : [];
  const ventas12m: Record<string, number> = {};
  for (const v of ventas ?? []) ventas12m[v.clave] = v.valor;

  const rol = ctx.profile.rol;

  return (
    <ProductosPanel
      initialProductos={productos ?? []}
      tiposCliente={tipos ?? []}
      cargaFallida={productos === null || tipos === null}
      ventas12m={ventas12m}
      resumen={resumen}
      abrirInicial={sp.abrir && UUID.test(sp.abrir) ? sp.abrir : ""}
      // As-is canEditProd: editar o asignar.
      canEdit={can(rol, "editar") || can(rol, "asignar")}
      // As-is: aprobar precios propuestos es `asignar`; el supervisor guarda en firme.
      canApprove={can(rol, "asignar")}
      esSupervisor={rol === "supervisor"}
    />
  );
}
