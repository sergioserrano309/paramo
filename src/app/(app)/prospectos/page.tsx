import { ProspectosPanel } from "@/components/ProspectosPanel";
import { isRol } from "@/config/roles";
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
import type {
  CatalogoItem,
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
  ResponsableOption,
  TipoClienteCatalogo,
} from "@/lib/types/prospecto";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ nuevo?: string; abrir?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProspectosPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("prospectos");
  const sp = await searchParams;
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

  let prospectos: ProspectoListItem[] = [];
  if (!prospectosRes.error && prospectosRes.data) {
    for (const row of prospectosRes.data as unknown as ProspectoRow[]) {
      prospectos.push(mapProspectoRow(row));
    }
    prospectos = await adjuntarSeguimiento(service, prospectos);
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
      userId={ctx.userId}
      userRol={ctx.profile.rol}
      // Atajo de teclado «N» y enlaces desde Supervisión / Dashboard / Bitácora.
      nuevoToken={sp.nuevo ?? ""}
      abrirInicial={sp.abrir && UUID.test(sp.abrir) ? sp.abrir : ""}
    />
  );
}
