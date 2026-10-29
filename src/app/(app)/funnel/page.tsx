import { FunnelPanel } from "@/components/FunnelPanel";
import { isRol } from "@/config/roles";
import { fetchProximosPorProspecto } from "@/lib/compromisos";
import {
  canCreateProspecto,
  requireModuleAccess,
} from "@/lib/permissions";
import {
  adjuntarSeguimiento,
  mapProspectoRow,
  PROSPECTO_SELECT_LIST,
  type ProspectoRow,
} from "@/lib/prospectos";
import { createServiceClient } from "@/lib/supabase-server";
import { filtroResponsablesOcultos } from "@/lib/visibilidad";
import type {
  CatalogoItem,
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
  ResponsableOption,} from "@/lib/types/prospecto";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const ctx = await requireModuleAccess("funnel");
  const service = createServiceClient();
  const ocultos = await filtroResponsablesOcultos(ctx.profile.rol);
  let prospectosQ = service
    .from("prospectos")
    .select(PROSPECTO_SELECT_LIST)
    .eq("activo", true)
    .order("calificacion", { ascending: false })
    .order("valor_mensual_estimado", { ascending: false })
    .limit(500);
  if (ocultos) prospectosQ = prospectosQ.not("responsable_id", "in", ocultos);

  const [
    prospectosRes,
    canalesRes,
    fuentesRes,
    etapasRes,
    profilesRes,
  ] = await Promise.all([
    prospectosQ,
    service
      .from("canales")
      .select("codigo, nombre, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    service
      .from("fuentes")
      .select("codigo, nombre, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    service
      .from("etapas_funnel")
      .select("codigo, nombre, orden, probabilidad, en_pipeline")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    service
      .from("profiles")
      .select("id, nombre, rol, activo")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(200),
  ]);

  let prospectos: ProspectoListItem[] = [];
  if (!prospectosRes.error && prospectosRes.data) {
    for (const row of prospectosRes.data as unknown as ProspectoRow[]) {
      prospectos.push(mapProspectoRow(row));
    }
    prospectos = await adjuntarSeguimiento(service, prospectos);
  }

  const proximosPorProspecto = await fetchProximosPorProspecto(
    service,
    prospectos.map((p) => p.id),
  );

  const responsables: ResponsableOption[] = [];
  if (!profilesRes.error && profilesRes.data) {
    for (const row of profilesRes.data) {
      if (!isRol(row.rol)) continue;
      responsables.push({
        id: row.id,
        nombre: row.nombre || row.id.slice(0, 8),
        rol: row.rol,
      });
    }
  }

  if (!responsables.some((r) => r.id === ctx.userId)) {
    responsables.unshift({
      id: ctx.userId,
      nombre: ctx.profile.nombre || "Tú",
      rol: ctx.profile.rol,
    });
  }

  const catalogos: ProspectosCatalogos = {
    canales: (canalesRes.data ?? []) as CatalogoItem[],
    fuentes: (fuentesRes.data ?? []) as CatalogoItem[],    etapas: (etapasRes.data ?? []) as EtapaCatalogo[],
    responsables,
  };

  const userId = ctx.userId;
  const userRol = ctx.profile.rol;

  return (
    <FunnelPanel
      initialProspectos={prospectos}
      catalogos={catalogos}
      canCreate={canCreateProspecto(userRol)}
      defaultResponsableId={userId}
      userId={userId}
      userRol={userRol}
      proximosPorProspecto={proximosPorProspecto}
    />
  );
}
