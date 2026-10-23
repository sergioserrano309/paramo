import { CompromisosPanel } from "@/components/CompromisosPanel";
import { isRol } from "@/config/roles";
import { cargarCompromisos } from "@/lib/compromisos";
import { can, requireModuleAccess } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase-server";
import type { PersonaOption } from "@/lib/types/compromiso";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ nuevo?: string; prospecto?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompromisosPage({ searchParams }: PageProps) {
  const ctx = await requireModuleAccess("compromisos");
  const sp = await searchParams;
  const service = createServiceClient();
  const rol = ctx.profile.rol;

  const [compromisos, perfilesRes, prospectosRes] = await Promise.all([
    cargarCompromisos(service, rol),
    service
      .from("profiles")
      .select("id, nombre, rol")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(200),
    service
      .from("prospectos")
      .select("id, empresa, activo")
      .order("empresa", { ascending: true })
      .limit(1_000),
  ]);

  const personas: PersonaOption[] = [];
  for (const p of perfilesRes.data ?? []) {
    if (isRol(p.rol)) {
      personas.push({ id: p.id, nombre: p.nombre || String(p.id).slice(0, 8), rol: p.rol });
    }
  }

  return (
    <CompromisosPanel
      initialCompromisos={compromisos ?? []}
      cargaFallida={compromisos === null}
      personas={personas}
      prospectos={(prospectosRes.data ?? []).map((p) => ({
        id: p.id as string,
        empresa: p.empresa as string,
        activo: p.activo !== false,
      }))}
      userId={ctx.userId}
      rol={rol}
      // Atajos desde Supervisión («Asignar tarea», «Asignar» en la cartera).
      nuevoToken={sp.nuevo ?? ""}
      prospectoInicial={sp.prospecto && UUID.test(sp.prospecto) ? sp.prospecto : ""}
      // As-is: crear = editar o asignar.
      puedeCrear={can(rol, "editar") || can(rol, "asignar")}
    />
  );
}
