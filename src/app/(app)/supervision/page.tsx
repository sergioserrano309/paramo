import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function SupervisionPage() {
  // Solo supervisor (as-is: VIEWS.only === 'supervisor').
  await requireModuleAccess("supervision");

  return (
    <ModulePlaceholder
      title="Supervisión"
      description="Bitácora y auditoría del rol supervisor. El alta de usuarios está en Usuarios."
    />
  );
}
