import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function FunnelPage() {
  await requireModuleAccess("funnel");

  return (
    <ModulePlaceholder
      title="Funnel"
      description="Pipeline por etapas y avance comercial."
    />
  );
}
