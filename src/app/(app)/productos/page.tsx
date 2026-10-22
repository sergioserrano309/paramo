import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function ProductosPage() {
  await requireModuleAccess("productos");

  return (
    <ModulePlaceholder
      title="Productos"
      description="Catálogo de referencias, PVP y estado."
    />
  );
}
