import { CompromisosPanel } from "@/components/CompromisosPanel";
import { isRol } from "@/config/roles";
import { fetchCompromisosAgenda } from "@/lib/compromisos";
import { canCreateCompromiso, requireModuleAccess } from "@/lib/permissions";
import {
  mapProspectoRow,
  PROSPECTO_SELECT_LIST,
  type ProspectoRow,
} from "@/lib/prospectos";
import { createServiceClient } from "@/lib/supabase-server";
import type { CompromisoAgendaItem } from "@/lib/types/compromiso";
import type {
  CatalogoItem,
  EtapaCatalogo,
  ProspectoListItem,
  ProspectosCatalogos,
  ResponsableOption,
  TipoClienteCatalogo,
} from "@/lib/types/prospecto";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ nuevo?: string; prospecto?: string }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompromisosPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("compromisos");
  const sp = await searchParams;
  const service = createServiceClient();
  const supervisor = ctx.profile.rol === "supervisor";

  const [
    compromisos,
    prospectosRes,
    etapasRes,
    canalesRes,
    fuentesRes,
    tiposRes,
    profilesRes,
  ] = await Promise.all([
    fetchCompromisosAgenda(service, supervisor ? null : ctx.userId),
    service
      .from("prospectos")
      .select(PROSPECTO_SELECT_LIST)
      .order("empresa", { ascending: true })
      .limit(500),
    service
      .from("etapas_funnel")
      .select("codigo, nombre, orden, probabilidad, en_pipeline")
      .eq("activo", true)
      .order("orden", { ascending: true }),
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
  if (profilesRes.data) {
    for (const row of profilesRes.data) {
      if (!isRol(row.rol)) continue;
      responsables.push({
        id: row.id,
        nombre: row.nombre || "Sin nombre",
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

  responsables.sort((a, b) => {
    if (a.rol !== b.rol) return a.rol === "comercial" ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  const items: CompromisoAgendaItem[] = compromisos ?? [];

  const catalogos: ProspectosCatalogos = {
    canales: (canalesRes.data ?? []) as CatalogoItem[],
    fuentes: (fuentesRes.data ?? []) as CatalogoItem[],
    tipos_cliente: (tiposRes.data ?? []) as TipoClienteCatalogo[],
    etapas: (etapasRes.data ?? []) as EtapaCatalogo[],
    responsables,
  };

  return (
    <CompromisosPanel
      initialCompromisos={items}
      loadError={compromisos === null}
      prospectos={prospectos}
      etapas={catalogos.etapas}
      catalogos={catalogos}
      responsables={supervisor ? responsables : []}
      canCreate={canCreateCompromiso(ctx.profile.rol)}
      userId={ctx.userId}
      userRol={ctx.profile.rol}
      // Atajo «C», Dashboard, Supervisión y ficha: abren el alta, con prospecto si viene.
      nuevoToken={sp.nuevo ?? ""}
      prospectoInicial={
        sp.prospecto && UUID.test(sp.prospecto) ? sp.prospecto : ""
      }
    />
  );
}
