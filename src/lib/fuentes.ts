import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FUENTE_OTRO } from "@/config/prospectos";

/** Texto del canal escrito a mano cuando «¿Cómo llegó?» es «Otro». */
export const fuenteOtroSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""))
  .pipe(z.string().max(80));

/** Código estable (snake_case, sin tildes) a partir del nombre que escribió el usuario. */
function slugFuente(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return base || "fuente";
}

async function buscarPorNombre(
  service: SupabaseClient,
  nombre: string,
): Promise<{ codigo: string; activo: boolean } | null> {
  // ilike sin comodines: igualdad sin distinguir mayúsculas. Se escapan _ % \ del texto.
  const patron = nombre.replace(/[\\%_]/g, (c) => "\\" + c);
  const { data } = await service
    .from("fuentes")
    .select("codigo, activo")
    .ilike("nombre", patron)
    .limit(1)
    .maybeSingle();
  return data ? { codigo: data.codigo as string, activo: data.activo !== false } : null;
}

/**
 * «¿Cómo llegó?» = «Otro» con un canal escrito a mano: devuelve el código de la fuente de ese
 * nombre y, si todavía no existe, la crea en el catálogo para que quede como opción del
 * desplegable (queda antes de «Otro», que se mantiene al final).
 *
 * Reutiliza la existente si el nombre ya está (sin distinguir mayúsculas), así no se duplican
 * opciones por una diferencia de tipeo. Devuelve null si no se pudo resolver.
 */
export async function resolverFuenteOtro(
  service: SupabaseClient,
  texto: string,
): Promise<string | null> {
  const nombre = texto.trim();
  if (!nombre) return null;

  const existente = await buscarPorNombre(service, nombre);
  if (existente) {
    if (!existente.activo) {
      await service.from("fuentes").update({ activo: true }).eq("codigo", existente.codigo);
    }
    return existente.codigo;
  }

  const { data: otro } = await service
    .from("fuentes")
    .select("orden")
    .eq("codigo", FUENTE_OTRO)
    .maybeSingle();
  let orden: number;
  if (otro) {
    orden = Number(otro.orden) || 0;
  } else {
    const { data: ultima } = await service
      .from("fuentes")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    orden = (Number(ultima?.orden) || 0) + 1;
  }

  const base = slugFuente(nombre);
  for (let intento = 0; intento < 5; intento++) {
    const codigo = intento === 0 ? base : `${base}_${intento + 1}`;
    const { error } = await service
      .from("fuentes")
      .insert({ codigo, nombre, orden, activo: true });
    if (!error) {
      // «Otro» se corre una posición para seguir al final del desplegable.
      if (otro) {
        await service.from("fuentes").update({ orden: orden + 1 }).eq("codigo", FUENTE_OTRO);
      }
      return codigo;
    }
    if (error.code !== "23505") return null;
    // 23505: o ya existe ese nombre (otro usuario lo creó a la vez) o ese código.
    const creada = await buscarPorNombre(service, nombre);
    if (creada) return creada.codigo;
  }
  return null;
}
