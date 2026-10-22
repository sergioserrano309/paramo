import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function VentasPage() {
  await requireModuleAccess("ventas");

  return (
    <ModulePlaceholder
      title="Ventas"
      description="Carga de Excel y consulta de ventas por mes."
    />
  );
}
