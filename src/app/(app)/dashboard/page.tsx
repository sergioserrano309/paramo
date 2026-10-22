import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function DashboardPage() {
  await requireModuleAccess("dashboard");

  return (
    <ModulePlaceholder
      title="Dashboard"
      description="KPIs, agenda y resumen comercial del día."
    />
  );
}
