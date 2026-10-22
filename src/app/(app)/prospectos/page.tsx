import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function ProspectosPage() {
  await requireModuleAccess("prospectos");

  return (
    <ModulePlaceholder
      title="Prospectos"
      description="Cartera de cuentas, calificación y responsables."
    />
  );
}
