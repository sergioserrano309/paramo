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
  EtapaCatalogo,
  ProspectoListItem,
  ResponsableOption,
} from "@/lib/types/prospecto";

export const dynamic = "force-dynamic";

export default async function CompromisosPage() {
  const ctx = await requireModuleAccess("compromisos");
  const service = createServiceClient();
  const supervisor = ctx.profile.rol === "supervisor";

  const [compromisos, prospectosRes, etapasRes, profilesRes] = await Promise.all([
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
    supervisor
      ? service
          .from("profiles")
          .select("id, nombre, rol, activo")
          .eq("activo", true)
          .order("nombre", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const prospectos: ProspectoListItem[] = [];
  if (!prospectosRes.error && prospectosRes.data) {
    for (const row of prospectosRes.data as unknown as ProspectoRow[]) {
      prospectos.push(mapProspectoRow(row));
    }
  }

  const responsables: ResponsableOption[] = [];
  if (supervisor && profilesRes.data) {
    for (const row of profilesRes.data) {
      if (!isRol(row.rol)) continue;
      responsables.push({
        id: row.id,
        nombre: row.nombre || "Sin nombre",
        rol: row.rol,
      });
    }
  }

  if (supervisor && !responsables.some((r) => r.id === ctx.userId)) {
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

  return (
    <CompromisosPanel
      initialCompromisos={items}
      loadError={compromisos === null}
      prospectos={prospectos}
      etapas={(etapasRes.data ?? []) as EtapaCatalogo[]}
      responsables={responsables}
      canCreate={canCreateCompromiso(ctx.profile.rol)}
      userId={ctx.userId}
      userRol={ctx.profile.rol}
    />
  );
}
