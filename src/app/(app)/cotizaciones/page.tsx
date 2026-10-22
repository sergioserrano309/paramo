import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { requireModuleAccess } from "@/lib/permissions";

export default async function CotizacionesPage() {
  await requireModuleAccess("cotizaciones");

  return (
    <ModulePlaceholder
      title="Cotizaciones"
      description="Borradores, aprobaciones de descuento y PDF."
    />
  );
}
