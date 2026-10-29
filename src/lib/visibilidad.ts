import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "@/config/roles";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * Los prospectos que tiene a su cargo el supervisor no los ve el comercial (ni sus
 * cotizaciones). El supervisor ve todo. Es una regla de lectura: se aplica en el servidor,
 * en cada lugar que lista o abre un prospecto, no solo ocultando botones.
 */

/** Ids de los supervisores; una sola consulta por petición. Falla cerrado: sin ellos no se muestra nada. */
const idsSupervisores = cache(async (): Promise<string[]> => {
  const { data, error } = await createServiceClient()
    .from("profiles")
    .select("id")
    .eq("rol", "supervisor")
    .limit(200);
  if (error) throw new Error("No se pudo resolver la visibilidad de prospectos.");
  return (data ?? []).map((r) => r.id as string);
});

/**
 * Valor para `.not("responsable_id", "in", …)` que deja fuera lo del supervisor, o null si
 * no hay nada que ocultar (rol supervisor, o no existen supervisores).
 */
export async function filtroResponsablesOcultos(rol: Rol): Promise<string | null> {
  if (rol !== "comercial") return null;
  const ids = await idsSupervisores();
  return ids.length ? `(${ids.join(",")})` : null;
}

/** ¿Puede este rol ver un prospecto cuyo responsable es `responsableId`? */
export async function puedeVerProspecto(rol: Rol, responsableId: string | null): Promise<boolean> {
  if (rol !== "comercial" || !responsableId) return true;
  return !(await idsSupervisores()).includes(responsableId);
}

/** Ids de los prospectos ocultos para este rol; para filtrar cotizaciones y listas ya cargadas. */
export async function idsProspectosOcultos(
  service: SupabaseClient,
  rol: Rol,
): Promise<Set<string>> {
  const filtro = await filtroResponsablesOcultos(rol);
  if (!filtro) return new Set();
  const ids = (await idsSupervisores()) as string[];
  const { data, error } = await service
    .from("prospectos")
    .select("id")
    .in("responsable_id", ids)
    .limit(5_000);
  if (error) throw new Error("No se pudo resolver la visibilidad de prospectos.");
  return new Set((data ?? []).map((r) => r.id as string));
}
