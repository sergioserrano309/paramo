import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function CompromisosPage() {
  await requireModuleAccess("compromisos");

  return (
    <ModulePlaceholder
      title="Compromisos"
      description="Agenda de seguimientos, visitas y tareas."
    />
  );
}
