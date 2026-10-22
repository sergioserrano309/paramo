import { ProspectosPanel } from "@/components/ProspectosPanel";
import { isRol } from "@/config/roles";
import {
  canCreateProspecto,
  requireModuleAccess,
} from "@/lib/permissions";
import {
  mapProspectoRow,
  PROSPECTO_SELECT_LIST,
  type ProspectoRow,
} from "@/lib/prospectos";
import { createServiceClient } from "@/lib/supabase-server";
import type {
  CatalogoItem,
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
  ResponsableOption,
  TipoClienteCatalogo,
} from "@/lib/types/prospecto";

export const dynamic = "force-dynamic";

export default async function ProspectosPage() {
  const ctx = await requireModuleAccess("prospectos");
  const service = createServiceClient();

  const [
    prospectosRes,
    canalesRes,
    fuentesRes,
    tiposRes,
    etapasRes,
    profilesRes,
  ] = await Promise.all([
    service
      .from("prospectos")
      .select(PROSPECTO_SELECT_LIST)
      .order("calificacion", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(500),
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
      .from("tipos_cliente")
      .select("codigo, nombre, orden, descuento_pct_default")
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

  const prospectos: ProspectoListItem[] = [];
  if (!prospectosRes.error && prospectosRes.data) {
    for (const row of prospectosRes.data as unknown as ProspectoRow[]) {
      prospectos.push(mapProspectoRow(row));
    }
  }

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
    fuentes: (fuentesRes.data ?? []) as CatalogoItem[],
    tipos_cliente: (tiposRes.data ?? []) as TipoClienteCatalogo[],
    etapas: (etapasRes.data ?? []) as EtapaCatalogo[],
    responsables,
  };

  // As-is: responsable por defecto = usuario actual (comercial o supervisor).
  const defaultResponsableId = ctx.userId;

  return (
    <ProspectosPanel
      initialProspectos={prospectos}
      catalogos={catalogos}
      canCreate={canCreateProspecto(ctx.profile.rol)}
      defaultResponsableId={defaultResponsableId}
    />
  );
}
