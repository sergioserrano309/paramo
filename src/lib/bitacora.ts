import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "@/config/roles";

type BitacoraRef = { tabla: string; id: string };

/** Lo mínimo del actor: sirve tanto con el contexto de sesión como en el login. */
type Actor = { userId: string; profile: { rol: Rol } };

/**
 * Registra una acción en `bitacora` (as-is log()). Es auditoría, no negocio: si falla no
 * debe tumbar la operación principal, así que el error se descarta en silencio.
 * Nunca pongas en `detalle` datos personales ni montos ligados a una persona (AGENTS §3.6).
 */
export async function registrarBitacora(
  service: SupabaseClient,
  auth: Actor,
  accion: string,
  detalle: string,
  ref?: BitacoraRef,
): Promise<void> {
  try {
    await service.from("bitacora").insert({
      actor_id: auth.userId,
      rol: auth.profile.rol,
      accion: accion.trim().slice(0, 120),
      detalle: detalle.slice(0, 400),
      ref_tabla: ref?.tabla ?? null,
      ref_id: ref?.id ?? null,
    });
  } catch {
    // Intencional: ver comentario de la función.
  }
}
