import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TIPOS_COMPROMISO, DIAS_HISTORIAL } from "@/config/compromisos";
import { isRol, type Rol } from "@/config/roles";
import { sumarDias } from "@/lib/fechas";
import { todayBogota } from "@/lib/format";
import { puedeVerCompromiso } from "@/lib/compromisos-permisos";
import type { CompromisoItem } from "@/lib/types/compromiso";

export const COMPROMISO_SELECT = `
  id, titulo, tipo, fecha, prospecto_id, notas, hecho, hecho_en,
  responsable_id, asignado, creado_por,
  responsable:profiles!compromisos_responsable_id_fkey ( nombre, rol ),
  prospecto:prospectos!compromisos_prospecto_id_fkey ( empresa )
`;

type CompromisoRow = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  prospecto_id: string | null;
  notas: string;
  hecho: boolean;
  hecho_en: string | null;
  responsable_id: string;
  asignado: boolean;
  creado_por: string | null;
  responsable: { nombre: string; rol: string } | null;
  prospecto: { empresa: string } | null;
};

export function mapCompromisoRow(row: CompromisoRow): CompromisoItem {
  const rol: Rol = row.responsable && isRol(row.responsable.rol) ? row.responsable.rol : "comercial";
  return {
    id: row.id,
    titulo: row.titulo,
    tipo: (TIPOS_COMPROMISO as readonly string[]).includes(row.tipo)
      ? (row.tipo as CompromisoItem["tipo"])
      : "Otro",
    fecha: row.fecha,
    prospecto_id: row.prospecto_id,
    prospecto_empresa: row.prospecto?.empresa ?? null,
    notas: row.notas ?? "",
    hecho: row.hecho,
    hecho_en: row.hecho_en,
    responsable_id: row.responsable_id,
    responsable_nombre: row.responsable?.nombre || row.responsable_id.slice(0, 8),
    responsable_rol: rol,
    asignado: row.asignado,
    creado_por: row.creado_por,
  };
}

/**
 * Pendientes (todos) + hechos de los últimos DIAS_HISTORIAL días, ya filtrados por lo que
 * el rol puede ver. Acotado: no se vuelca el historial completo al navegador (AGENTS §4).
 */
export async function cargarCompromisos(
  service: SupabaseClient,
  rol: Rol,
): Promise<CompromisoItem[] | null> {
  const desde = sumarDias(todayBogota(), -DIAS_HISTORIAL);
  const [pend, hechos] = await Promise.all([
    service
      .from("compromisos")
      .select(COMPROMISO_SELECT)
      .eq("hecho", false)
      .order("fecha", { ascending: true })
      .limit(1_000),
    service
      .from("compromisos")
      .select(COMPROMISO_SELECT)
      .eq("hecho", true)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(1_000),
  ]);
  if (pend.error || hechos.error) return null;
  const rows = [...(pend.data ?? []), ...(hechos.data ?? [])] as unknown as CompromisoRow[];
  return rows.map(mapCompromisoRow).filter((c) => puedeVerCompromiso(rol, c));
}

export async function cargarCompromiso(
  service: SupabaseClient,
  id: string,
): Promise<CompromisoItem | null> {
  const { data, error } = await service
    .from("compromisos")
    .select(COMPROMISO_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCompromisoRow(data as unknown as CompromisoRow);
}

export const compromisoSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  tipo: z.enum(TIPOS_COMPROMISO),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((f) => {
      const d = new Date(`${f}T12:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
    }),
  prospecto_id: z.string().uuid().nullable().optional(),
  notas: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(500)),
  responsable_id: z.string().uuid().nullable().optional(),
});

/** El responsable debe ser un usuario activo. */
export async function responsableValido(
  service: SupabaseClient,
  id: string,
): Promise<{ id: string; nombre: string; rol: Rol } | null> {
  const { data, error } = await service
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || !data.activo || !isRol(data.rol)) return null;
  return { id: data.id as string, nombre: (data.nombre as string) || "—", rol: data.rol };
}
