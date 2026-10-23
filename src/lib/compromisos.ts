import { isRol, type Rol } from "@/config/roles";
import type {
  CompromisoAgendaItem,
  ProximoCompromiso,
} from "@/lib/types/compromiso";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Agenda de /compromisos. El embed de profiles nombra la FK porque
 * creado_por también apunta a profiles.
 */
export const COMPROMISO_AGENDA_SELECT = `
  id, titulo, tipo, fecha, prospecto_id, hecho, hecho_en, notas, asignado,
  responsable_id, creado_por,
  prospecto:prospectos!compromisos_prospecto_id_fkey ( empresa ),
  responsable:profiles!compromisos_responsable_id_fkey ( nombre, rol )
`;

type NombreJoin = { empresa: string } | { empresa: string }[] | null;
type ResponsableJoin =
  | { nombre: string; rol: string }
  | { nombre: string; rol: string }[]
  | null;

export type CompromisoAgendaRow = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  prospecto_id: string | null;
  hecho: boolean;
  hecho_en: string | null;
  notas: string;
  asignado: boolean;
  responsable_id: string | null;
  creado_por: string | null;
  prospecto: NombreJoin;
  responsable: ResponsableJoin;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapCompromisoAgenda(row: CompromisoAgendaRow): CompromisoAgendaItem {
  const prospecto = one(row.prospecto);
  const responsable = one(row.responsable);
  const rol: Rol | null =
    responsable && isRol(responsable.rol) ? responsable.rol : null;
  return {
    id: row.id,
    titulo: row.titulo,
    tipo: row.tipo,
    fecha: row.fecha,
    prospecto_id: row.prospecto_id,
    prospecto_empresa: prospecto?.empresa ?? null,
    hecho: row.hecho === true,
    hecho_en: row.hecho_en,
    notas: row.notas ?? "",
    asignado: row.asignado === true,
    responsable_id: row.responsable_id,
    responsable_nombre: responsable?.nombre || "—",
    responsable_rol: rol,
    creado_por: row.creado_por,
  };
}

const AGENDA_LIMIT = 2000;

/**
 * Lista la agenda visible. `responsableId` null = todos (supervisor).
 * Tope 2000 por fecha ascendente: cubre vencidos antiguos y lo próximo.
 * Devuelve null si la consulta falla.
 */
export async function fetchCompromisosAgenda(
  service: SupabaseClient,
  responsableId: string | null,
  prospectoId?: string | null,
): Promise<CompromisoAgendaItem[] | null> {
  let query = service
    .from("compromisos")
    .select(COMPROMISO_AGENDA_SELECT)
    .order("fecha", { ascending: true })
    .limit(AGENDA_LIMIT);

  if (responsableId) {
    query = query.eq("responsable_id", responsableId);
  }
  if (prospectoId) {
    query = query.eq("prospecto_id", prospectoId);
  }

  const { data, error } = await query;
  if (error || !data) return null;
  return (data as unknown as CompromisoAgendaRow[]).map(mapCompromisoAgenda);
}

export async function fetchCompromisoAgendaById(
  service: SupabaseClient,
  id: string,
): Promise<{ item: CompromisoAgendaItem | null; error: boolean }> {
  const { data, error } = await service
    .from("compromisos")
    .select(COMPROMISO_AGENDA_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return { item: null, error: true };
  if (!data) return { item: null, error: false };
  return {
    item: mapCompromisoAgenda(data as unknown as CompromisoAgendaRow),
    error: false,
  };
}

type CompromisoPendienteRow = {
  id: string;
  prospecto_id: string;
  titulo: string;
  tipo: string;
  fecha: string;
};

/**
 * Lee pendientes con prospecto y deja el más próximo por prospecto_id
 * (as-is nextComp: !hecho, orden por fecha).
 * Si la tabla aún no existe en el proyecto, devuelve mapa vacío.
 */
export async function fetchProximosPorProspecto(
  service: SupabaseClient,
  prospectoIds: string[],
): Promise<Record<string, ProximoCompromiso>> {
  const map: Record<string, ProximoCompromiso> = {};
  if (prospectoIds.length === 0) return map;

  const { data, error } = await service
    .from("compromisos")
    .select("id, prospecto_id, titulo, tipo, fecha")
    .eq("hecho", false)
    .in("prospecto_id", prospectoIds)
    .order("fecha", { ascending: true })
    .limit(2000);

  if (error || !data) return map;

  for (const row of data as CompromisoPendienteRow[]) {
    if (!row.prospecto_id || map[row.prospecto_id]) continue;
    map[row.prospecto_id] = {
      id: row.id,
      prospecto_id: row.prospecto_id,
      titulo: row.titulo,
      tipo: row.tipo,
      fecha: row.fecha,
    };
  }
  return map;
}

export async function responsableActivo(
  service: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("profiles")
    .select("id, activo, rol")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return false;
  return data.activo === true && isRol(data.rol as string);
}

export async function prospectoExiste(
  service: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("prospectos")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !error && !!data;
}
